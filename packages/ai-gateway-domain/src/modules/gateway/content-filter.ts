// ---------------------------------------------------------------------------
// Gateway Content Filter – pluggable chain that scans request / response
// text for policy violations (keywords, PII, custom regex) before relay.
// ---------------------------------------------------------------------------

// ---- Types ----------------------------------------------------------------

export type GatewayContentFilterVerdict = "pass" | "warn" | "block";

export type GatewayContentFilterMatch = {
  filterName: string;
  severity: "low" | "medium" | "high" | "critical";
  matched: string; // what was matched (redacted if PII)
  context?: string; // surrounding context
};

export type GatewayContentFilterResult = {
  verdict: GatewayContentFilterVerdict;
  matches: GatewayContentFilterMatch[];
  scannedAt: string; // ISO-8601
  durationMs: number;
};

export type GatewayContentFilter = {
  name: string;
  enabled: boolean;
  scan: (content: string) => GatewayContentFilterMatch[];
};

export type GatewayContentFilterChainConfig = {
  enabled: boolean;
  filters: GatewayContentFilter[];
  /** If any match has severity >= this, verdict is "block" */
  blockThreshold: "low" | "medium" | "high" | "critical";
  /** If any match has severity >= this (but below block), verdict is "warn" */
  warnThreshold: "low" | "medium" | "high" | "critical";
};

// ---- Helpers --------------------------------------------------------------

const SEVERITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function severityRank(s: "low" | "medium" | "high" | "critical"): number {
  return SEVERITY_RANK[s];
}

/**
 * Extract a short context window around `index` in `text`.
 */
function extractContext(
  text: string,
  index: number,
  matchLength: number,
  windowSize = 30,
): string {
  const start = Math.max(0, index - windowSize);
  const end = Math.min(text.length, index + matchLength + windowSize);
  let ctx = text.slice(start, end);
  if (start > 0) ctx = "..." + ctx;
  if (end < text.length) ctx = ctx + "...";
  return ctx;
}

// ---- Keyword Filter -------------------------------------------------------

export function createKeywordFilter(args: {
  keywords: string[];
  severity: "low" | "medium" | "high" | "critical";
  caseSensitive?: boolean;
}): GatewayContentFilter {
  const { keywords, severity, caseSensitive = false } = args;

  return {
    name: "keyword",
    enabled: true,
    scan(content: string): GatewayContentFilterMatch[] {
      const matches: GatewayContentFilterMatch[] = [];
      const haystack = caseSensitive ? content : content.toLowerCase();

      for (const kw of keywords) {
        const needle = caseSensitive ? kw : kw.toLowerCase();
        let searchFrom = 0;
        while (true) {
          const idx = haystack.indexOf(needle, searchFrom);
          if (idx === -1) break;
          matches.push({
            filterName: "keyword",
            severity,
            matched: content.slice(idx, idx + needle.length),
            context: extractContext(content, idx, needle.length),
          });
          searchFrom = idx + needle.length;
        }
      }

      return matches;
    },
  };
}

// ---- PII Filter -----------------------------------------------------------

const PII_PATTERNS: Array<{
  label: string;
  regex: RegExp;
  redact: (m: string) => string;
}> = [
  {
    label: "email",
    regex: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    redact(m: string) {
      const [local, domain] = m.split("@");
      return local[0] + "***@" + domain;
    },
  },
  {
    label: "phone",
    // Matches common phone formats: +1-555-123-4567, (555) 123-4567, 555.123.4567, etc.
    regex: /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g,
    redact(m: string) {
      return m.slice(0, 3) + "***" + m.slice(-2);
    },
  },
  {
    label: "credit-card",
    // 13–19 digit sequences optionally separated by dashes or spaces
    regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,7}\b/g,
    redact(m: string) {
      const digits = m.replace(/[-\s]/g, "");
      return digits.slice(0, 4) + " **** **** " + digits.slice(-4);
    },
  },
  {
    label: "ssn",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    redact(m: string) {
      return "***-**-" + m.slice(-4);
    },
  },
  {
    label: "ip-address",
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    redact(m: string) {
      const parts = m.split(".");
      return parts[0] + ".***.***." + parts[3];
    },
  },
];

export function createPiiFilter(): GatewayContentFilter {
  return {
    name: "pii",
    enabled: true,
    scan(content: string): GatewayContentFilterMatch[] {
      const matches: GatewayContentFilterMatch[] = [];

      for (const { label, regex, redact } of PII_PATTERNS) {
        // Reset lastIndex for each scan call since we reuse the regex objects
        regex.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(content)) !== null) {
          matches.push({
            filterName: "pii",
            severity: "high",
            matched: redact(m[0]),
            context: extractContext(content, m.index, m[0].length),
          });
        }
      }

      return matches;
    },
  };
}

// ---- Regex Filter ---------------------------------------------------------

export function createRegexFilter(args: {
  name: string;
  patterns: Array<{
    pattern: string;
    flags?: string;
    severity: "low" | "medium" | "high" | "critical";
  }>;
}): GatewayContentFilter {
  const compiledPatterns = args.patterns.map((p) => ({
    regex: new RegExp(p.pattern, p.flags ?? "g"),
    severity: p.severity,
  }));

  return {
    name: args.name,
    enabled: true,
    scan(content: string): GatewayContentFilterMatch[] {
      const matches: GatewayContentFilterMatch[] = [];

      for (const { regex, severity } of compiledPatterns) {
        regex.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(content)) !== null) {
          matches.push({
            filterName: args.name,
            severity,
            matched: m[0],
            context: extractContext(content, m.index, m[0].length),
          });
          // Prevent infinite loop for zero-length matches
          if (m[0].length === 0) {
            regex.lastIndex++;
          }
        }
      }

      return matches;
    },
  };
}

// ---- Filter Chain Runner --------------------------------------------------

export function runGatewayContentFilterChain(
  content: string,
  config: GatewayContentFilterChainConfig,
): GatewayContentFilterResult {
  const startTime = performance.now();

  if (!config.enabled) {
    return {
      verdict: "pass",
      matches: [],
      scannedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  const allMatches: GatewayContentFilterMatch[] = [];

  for (const filter of config.filters) {
    if (!filter.enabled) continue;
    const filterMatches = filter.scan(content);
    allMatches.push(...filterMatches);
  }

  // Determine verdict based on highest severity match vs thresholds
  let verdict: GatewayContentFilterVerdict = "pass";
  for (const match of allMatches) {
    const rank = severityRank(match.severity);
    if (rank >= severityRank(config.blockThreshold)) {
      verdict = "block";
      break; // block is the highest verdict, no need to continue
    }
    if (rank >= severityRank(config.warnThreshold)) {
      verdict = "warn";
    }
  }

  return {
    verdict,
    matches: allMatches,
    scannedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startTime),
  };
}

// ---- Message Text Extractor -----------------------------------------------

/**
 * Extract plain text content from a chat messages array.
 * Handles both OpenAI-style and Anthropic-style message formats:
 *  - string content
 *  - array content with `{ type: "text", text: "..." }` parts
 */
export function extractTextFromMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return "";

  const parts: string[] = [];

  for (const msg of messages) {
    if (msg == null || typeof msg !== "object") continue;

    const content = (msg as Record<string, unknown>).content;

    if (typeof content === "string") {
      parts.push(content);
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (
          part != null &&
          typeof part === "object" &&
          (part as Record<string, unknown>).type === "text" &&
          typeof (part as Record<string, unknown>).text === "string"
        ) {
          parts.push((part as Record<string, string>).text);
        }
      }
    }
  }

  return parts.join("\n");
}

// ---- Default Chain Builder ------------------------------------------------

export function buildDefaultFilterChain(): GatewayContentFilterChainConfig {
  return {
    enabled: true,
    filters: [
      createPiiFilter(),
      createKeywordFilter({ keywords: [], severity: "medium" }),
    ],
    blockThreshold: "critical",
    warnThreshold: "high",
  };
}
