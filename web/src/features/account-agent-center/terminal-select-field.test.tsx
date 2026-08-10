import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TerminalSelectField } from "./terminal-select-field";

const source = readFileSync(new URL("./terminal-select-field.tsx", import.meta.url), "utf8");

test("terminal select exposes a named listbox relationship", () => {
  const html = renderToStaticMarkup(
    createElement(TerminalSelectField, {
      name: "model",
      options: [{ label: "Neuro", value: "neuro" }],
      placeholder: "选择模型",
    }),
  );

  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, /aria-controls="[^"]+"/);
  assert.match(html, /role="combobox"/);
});

test("terminal select keeps keyboard navigation and active descendant semantics", () => {
  assert.match(source, /aria-activedescendant=/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /ignoreNextKeyboardClickRef/);
  assert.match(source, /onKeyUp=\{handleTriggerKeyUp\}/);
  assert.doesNotMatch(source, /<button[^>]*role="option"/);
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"]) {
    assert.match(source, new RegExp(`event\\.key === ${JSON.stringify(key)}`));
  }
});
