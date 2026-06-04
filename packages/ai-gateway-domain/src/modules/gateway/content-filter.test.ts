import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDefaultFilterChain,
  createKeywordFilter,
  createPiiFilter,
  createRegexFilter,
  extractTextFromMessages,
  runGatewayContentFilterChain,
} from "./content-filter";

import type {
  GatewayContentFilterChainConfig,
} from "./content-filter";

// ---- Keyword Filter -------------------------------------------------------

test("createKeywordFilter matches keywords case-insensitively by default", () => {
  const filter = createKeywordFilter({
    keywords: ["bomb", "attack"],
    severity: "critical",
  });
  const matches = filter.scan("There was a BOMB threat and an Attack plan.");
  assert.equal(matches.length, 2);
  assert.equal(matches[0].matched, "BOMB");
  assert.equal(matches[0].severity, "critical");
  assert.equal(matches[1].matched, "Attack");
});

test("createKeywordFilter respects caseSensitive flag", () => {
  const filter = createKeywordFilter({
    keywords: ["Secret"],
    severity: "high",
    caseSensitive: true,
  });
  assert.equal(filter.scan("This is a Secret document.").length, 1);
  assert.equal(filter.scan("This is a secret document.").length, 0);
});

test("createKeywordFilter finds multiple occurrences of same keyword", () => {
  const filter = createKeywordFilter({
    keywords: ["test"],
    severity: "low",
  });
  const matches = filter.scan("test one test two test three");
  assert.equal(matches.length, 3);
});

test("createKeywordFilter returns empty matches when no keywords match", () => {
  const filter = createKeywordFilter({
    keywords: ["xyz123"],
    severity: "medium",
  });
  const matches = filter.scan("Nothing suspicious here.");
  assert.equal(matches.length, 0);
});

test("createKeywordFilter includes context in matches", () => {
  const filter = createKeywordFilter({
    keywords: ["danger"],
    severity: "high",
  });
  const matches = filter.scan("There is a danger ahead in the road.");
  assert.equal(matches.length, 1);
  assert.ok(matches[0].context !== undefined);
  assert.ok(matches[0].context!.includes("danger"));
});

// ---- PII Filter -----------------------------------------------------------

test("createPiiFilter detects email addresses and redacts them", () => {
  const filter = createPiiFilter();
  const matches = filter.scan("Contact john@example.com for details.");
  const emailMatch = matches.find((m) => m.matched.includes("@"));
  assert.ok(emailMatch, "should detect email");
  assert.equal(emailMatch.severity, "high");
  assert.equal(emailMatch.matched, "j***@example.com");
  assert.equal(emailMatch.filterName, "pii");
});

test("createPiiFilter detects SSN patterns and redacts them", () => {
  const filter = createPiiFilter();
  const matches = filter.scan("SSN: 123-45-6789");
  const ssnMatch = matches.find((m) => m.matched.includes("***-**-"));
  assert.ok(ssnMatch, "should detect SSN");
  assert.equal(ssnMatch.matched, "***-**-6789");
});

test("createPiiFilter detects IP addresses and redacts them", () => {
  const filter = createPiiFilter();
  const matches = filter.scan("Server at 192.168.1.100");
  const ipMatch = matches.find((m) => m.matched.includes("***.***"));
  assert.ok(ipMatch, "should detect IP");
  assert.equal(ipMatch.matched, "192.***.***.100");
});

test("createPiiFilter detects credit card numbers and redacts them", () => {
  const filter = createPiiFilter();
  const matches = filter.scan("Card: 4111-1111-1111-1111");
  const ccMatch = matches.find((m) => m.matched.includes("****"));
  assert.ok(ccMatch, "should detect credit card");
  assert.ok(ccMatch.matched.startsWith("4111"));
  assert.ok(ccMatch.matched.endsWith("1111"));
});

test("createPiiFilter returns empty matches for clean content", () => {
  const filter = createPiiFilter();
  const matches = filter.scan("Hello, this is a normal sentence.");
  assert.equal(matches.length, 0);
});

// ---- Regex Filter ---------------------------------------------------------

test("createRegexFilter matches custom patterns", () => {
  const filter = createRegexFilter({
    name: "custom-profanity",
    patterns: [
      { pattern: "\\bbad_word\\b", flags: "gi", severity: "medium" },
      { pattern: "\\bterrible\\b", flags: "gi", severity: "low" },
    ],
  });
  const matches = filter.scan("This is a bad_word and terrible thing.");
  assert.equal(matches.length, 2);
  assert.equal(matches[0].filterName, "custom-profanity");
  assert.equal(matches[0].severity, "medium");
  assert.equal(matches[1].severity, "low");
});

test("createRegexFilter returns empty matches when nothing matches", () => {
  const filter = createRegexFilter({
    name: "test-filter",
    patterns: [{ pattern: "zzz_no_match_zzz", severity: "critical" }],
  });
  assert.equal(filter.scan("normal text").length, 0);
});

test("createRegexFilter uses name argument as filter name", () => {
  const filter = createRegexFilter({
    name: "my-filter",
    patterns: [{ pattern: "hello", severity: "low" }],
  });
  const matches = filter.scan("hello world");
  assert.equal(matches[0].filterName, "my-filter");
});

// ---- Filter Chain Runner --------------------------------------------------

test("runGatewayContentFilterChain returns pass when chain is disabled", () => {
  const config: GatewayContentFilterChainConfig = {
    enabled: false,
    filters: [createKeywordFilter({ keywords: ["bomb"], severity: "critical" })],
    blockThreshold: "critical",
    warnThreshold: "high",
  };
  const result = runGatewayContentFilterChain("bomb is here", config);
  assert.equal(result.verdict, "pass");
  assert.equal(result.matches.length, 0);
});

test("runGatewayContentFilterChain returns pass when no matches", () => {
  const config: GatewayContentFilterChainConfig = {
    enabled: true,
    filters: [createKeywordFilter({ keywords: ["xyz"], severity: "critical" })],
    blockThreshold: "critical",
    warnThreshold: "high",
  };
  const result = runGatewayContentFilterChain("clean text", config);
  assert.equal(result.verdict, "pass");
  assert.equal(result.matches.length, 0);
});

test("runGatewayContentFilterChain returns block when severity >= blockThreshold", () => {
  const config: GatewayContentFilterChainConfig = {
    enabled: true,
    filters: [createKeywordFilter({ keywords: ["exploit"], severity: "critical" })],
    blockThreshold: "critical",
    warnThreshold: "high",
  };
  const result = runGatewayContentFilterChain("use exploit code", config);
  assert.equal(result.verdict, "block");
  assert.ok(result.matches.length > 0);
});

test("runGatewayContentFilterChain returns warn when severity >= warnThreshold but < blockThreshold", () => {
  const config: GatewayContentFilterChainConfig = {
    enabled: true,
    filters: [createKeywordFilter({ keywords: ["suspicious"], severity: "high" })],
    blockThreshold: "critical",
    warnThreshold: "high",
  };
  const result = runGatewayContentFilterChain("found suspicious activity", config);
  assert.equal(result.verdict, "warn");
});

test("runGatewayContentFilterChain skips disabled filters", () => {
  const disabledFilter = createKeywordFilter({ keywords: ["danger"], severity: "critical" });
  disabledFilter.enabled = false;
  const config: GatewayContentFilterChainConfig = {
    enabled: true,
    filters: [disabledFilter],
    blockThreshold: "critical",
    warnThreshold: "high",
  };
  const result = runGatewayContentFilterChain("danger ahead", config);
  assert.equal(result.verdict, "pass");
  assert.equal(result.matches.length, 0);
});

test("runGatewayContentFilterChain aggregates matches from multiple filters", () => {
  const config: GatewayContentFilterChainConfig = {
    enabled: true,
    filters: [
      createKeywordFilter({ keywords: ["bad"], severity: "medium" }),
      createPiiFilter(),
    ],
    blockThreshold: "critical",
    warnThreshold: "high",
  };
  const result = runGatewayContentFilterChain(
    "bad user at john@example.com",
    config,
  );
  // At least one keyword match and one PII match
  const keywordMatches = result.matches.filter((m) => m.filterName === "keyword");
  const piiMatches = result.matches.filter((m) => m.filterName === "pii");
  assert.ok(keywordMatches.length >= 1);
  assert.ok(piiMatches.length >= 1);
});

test("runGatewayContentFilterChain includes scannedAt and durationMs", () => {
  const config: GatewayContentFilterChainConfig = {
    enabled: true,
    filters: [],
    blockThreshold: "critical",
    warnThreshold: "high",
  };
  const result = runGatewayContentFilterChain("anything", config);
  assert.ok(result.scannedAt);
  assert.ok(typeof result.durationMs === "number");
  assert.ok(result.durationMs >= 0);
});

test("runGatewayContentFilterChain: block overrides warn when both present", () => {
  const config: GatewayContentFilterChainConfig = {
    enabled: true,
    filters: [
      createKeywordFilter({ keywords: ["minor"], severity: "high" }),
      createKeywordFilter({ keywords: ["major"], severity: "critical" }),
    ],
    blockThreshold: "critical",
    warnThreshold: "high",
  };
  const result = runGatewayContentFilterChain("minor issue and major issue", config);
  assert.equal(result.verdict, "block");
});

test("runGatewayContentFilterChain: low severity stays pass when thresholds are high", () => {
  const config: GatewayContentFilterChainConfig = {
    enabled: true,
    filters: [createKeywordFilter({ keywords: ["note"], severity: "low" })],
    blockThreshold: "critical",
    warnThreshold: "high",
  };
  const result = runGatewayContentFilterChain("just a note", config);
  assert.equal(result.verdict, "pass");
  assert.ok(result.matches.length > 0);
});

// ---- extractTextFromMessages ----------------------------------------------

test("extractTextFromMessages handles OpenAI-style string content", () => {
  const messages = [
    { role: "user", content: "Hello world" },
    { role: "assistant", content: "Hi there" },
  ];
  const text = extractTextFromMessages(messages);
  assert.ok(text.includes("Hello world"));
  assert.ok(text.includes("Hi there"));
});

test("extractTextFromMessages handles Anthropic-style array content", () => {
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: "First part" },
        { type: "image", source: {} },
        { type: "text", text: "Second part" },
      ],
    },
  ];
  const text = extractTextFromMessages(messages);
  assert.ok(text.includes("First part"));
  assert.ok(text.includes("Second part"));
  assert.ok(!text.includes("image"));
});

test("extractTextFromMessages handles mixed string and array content", () => {
  const messages = [
    { role: "user", content: "Plain string" },
    { role: "user", content: [{ type: "text", text: "Array text" }] },
  ];
  const text = extractTextFromMessages(messages);
  assert.ok(text.includes("Plain string"));
  assert.ok(text.includes("Array text"));
});

test("extractTextFromMessages returns empty string for non-array input", () => {
  assert.equal(extractTextFromMessages(null), "");
  assert.equal(extractTextFromMessages(undefined), "");
  assert.equal(extractTextFromMessages("string"), "");
  assert.equal(extractTextFromMessages(42), "");
});

test("extractTextFromMessages skips null and non-object entries", () => {
  const messages = [null, undefined, 42, { role: "user", content: "Valid" }];
  const text = extractTextFromMessages(messages);
  assert.ok(text.includes("Valid"));
});

// ---- buildDefaultFilterChain ----------------------------------------------

test("buildDefaultFilterChain returns a valid config with PII filter enabled", () => {
  const config = buildDefaultFilterChain();
  assert.equal(config.enabled, true);
  assert.equal(config.blockThreshold, "critical");
  assert.equal(config.warnThreshold, "high");
  assert.ok(config.filters.length >= 1);

  const piiFilter = config.filters.find((f) => f.name === "pii");
  assert.ok(piiFilter, "should include PII filter");
  assert.equal(piiFilter.enabled, true);
});

test("buildDefaultFilterChain keyword filter has empty keywords by default", () => {
  const config = buildDefaultFilterChain();
  const keywordFilter = config.filters.find((f) => f.name === "keyword");
  assert.ok(keywordFilter, "should include keyword filter");
  // With empty keywords, nothing should match
  const matches = keywordFilter.scan("any text at all");
  assert.equal(matches.length, 0);
});

test("buildDefaultFilterChain integration: PII triggers warn verdict", () => {
  const config = buildDefaultFilterChain();
  const result = runGatewayContentFilterChain(
    "Contact me at alice@corp.io",
    config,
  );
  // PII is high severity, warnThreshold is high => warn
  assert.equal(result.verdict, "warn");
  assert.ok(result.matches.length > 0);
});
