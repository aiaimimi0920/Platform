import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sponsorSource = readFileSync(new URL("./ProjectSponsorPanel.tsx", import.meta.url), "utf8");
const joinSource = readFileSync(new URL("./ProjectJoinPanel.tsx", import.meta.url), "utf8");

test("project sponsorship submit reflects server action pending state", () => {
  assert.match(sponsorSource, /import \{ useFormStatus \} from "react-dom"/);
  assert.match(sponsorSource, /const \{ pending \} = useFormStatus\(\);/);
  assert.match(sponsorSource, /disabled=\{disabled\}/);
  assert.match(sponsorSource, /pending \? "提交中\.\.\."/);
});

test("project join submit reflects server action pending state", () => {
  assert.match(joinSource, /import \{ useFormStatus \} from "react-dom"/);
  assert.match(joinSource, /const \{ pending \} = useFormStatus\(\);/);
  assert.match(joinSource, /disabled=\{isDisabled\}/);
  assert.match(joinSource, /pending\s*\? "提交中\.\.\."/);
});
