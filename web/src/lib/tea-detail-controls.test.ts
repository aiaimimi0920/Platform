import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getTeaTicketDetailControls,
  isTerminalTeaTicketStatus,
} from "./tea-detail-controls";

test("active Tea tickets expose review mutations, stop/retry lifecycle controls, and download links", () => {
  const controls = getTeaTicketDetailControls("ticket/with space", "running");

  assert.equal(controls.canMutate, true);
  assert.equal(controls.showCommentForm, true);
  assert.equal(controls.showRejectForm, true);
  assert.deepEqual(
    controls.lifecycleControls.map((control) => control.action),
    ["decompose", "analyze", "plan", "approve", "run", "stop", "retry", "accept", "close", "cancel"],
  );
  assert.deepEqual(
    controls.lifecycleControls.filter((control) => control.requiresRun).map((control) => control.action),
    ["stop", "retry"],
  );
  assert.deepEqual(controls.downloadLinks, [
    {
      href: "/api/tea/tickets/ticket%2Fwith%20space/export/json/download",
      label: "下载 JSON",
    },
    {
      href: "/api/tea/tickets/ticket%2Fwith%20space/export/markdown/download",
      label: "下载 Markdown",
    },
  ]);
});

test("terminal Tea tickets keep audit downloads but hide mutating review controls", () => {
  assert.equal(isTerminalTeaTicketStatus("closed"), true);

  const controls = getTeaTicketDetailControls("ticket-closed", "closed");

  assert.equal(controls.canMutate, false);
  assert.equal(controls.showCommentForm, false);
  assert.equal(controls.showRejectForm, false);
  assert.deepEqual(controls.lifecycleControls, []);
  assert.equal(controls.downloadLinks.length, 2);
});
