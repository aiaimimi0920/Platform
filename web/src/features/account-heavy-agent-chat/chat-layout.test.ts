import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const workspace = readFileSync(new URL("./chat-workspace.tsx", import.meta.url), "utf8");

test("P2-05: active chat reserves fixed rows for the header and composer", () => {
  assert.match(
    styles,
    /\.nt-chat-app__main\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;[^}]*\}/s,
  );
});

test("P2-05: workflow action errors wrap without widening the message column", () => {
  assert.match(
    styles,
    /\.nt-chat-app-message__action-state\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*min-width:\s*0;[^}]*\}/s,
  );
  assert.match(
    styles,
    /\.nt-chat-app-message__action-state\s*>\s*span\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;[^}]*\}/s,
  );
});

test("P2-05: long assistant content cannot widen the mobile message column", () => {
  assert.match(
    styles,
    /\.nt-chat-app-message__content\s*\{[^}]*min-width:\s*0;[^}]*\}/s,
  );
  assert.match(
    styles,
    /\.nt-chat-app-message__bubble\s*\{[^}]*min-width:\s*0;[^}]*\}/s,
  );
  assert.match(
    styles,
    /\.nt-chat-app-message__actions\s*\{[^}]*min-width:\s*0;[^}]*\}/s,
  );
});

test("heavy chat older-page control preserves the reading position and keyboard focus", () => {
  assert.match(workspace, /activeThread\.hasMoreMessages/);
  assert.match(workspace, /threadState\.loadEarlierMessages\(threadId\)/);
  assert.match(workspace, /currentViewport\.scrollHeight - previousScrollHeight/);
  assert.match(
    styles,
    /\.nt-chat-app__load-earlier:focus-visible\s*\{[^}]*outline:\s*2px solid #d9ff38;[^}]*\}/s,
  );
  assert.match(
    styles,
    /\.nt-chat-app__load-earlier\s*\{[^}]*border-radius:\s*8px;[^}]*\}/s,
  );
});
