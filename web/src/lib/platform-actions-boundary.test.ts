import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const libDir = join(process.cwd(), "src", "lib");

const commerceActionNames = [
  "submitOrderAction",
  "upsertOperatorProductAction",
  "deleteOperatorProductAction",
  "upsertOperatorDiscountCodeAction",
  "applyOperatorDiscountCodeBatchAction",
  "importOperatorDiscountCodesCsvAction",
  "previewOperatorDiscountCodesCsvAction",
  "createListingAction",
  "purchaseListingAction",
] as const;

describe("platform action module boundaries", () => {
  it("keeps commerce/product/discount actions in their domain module", () => {
    const platformActions = readFileSync(join(libDir, "platform-actions.ts"), "utf8");
    const commerceActions = readFileSync(join(libDir, "platform-commerce-actions.ts"), "utf8");

    assert.match(commerceActions, /^"use server";/);

    for (const actionName of commerceActionNames) {
      const implementationName = `${actionName}Impl`;
      assert.match(
        commerceActions,
        new RegExp(`export async function ${actionName}\\(`),
        `${actionName} should be implemented in platform-commerce-actions.ts`,
      );
      assert.match(
        platformActions,
        new RegExp(`${actionName} as ${implementationName}`),
        `${actionName} should be imported as a compatibility wrapper implementation`,
      );
      assert.match(
        platformActions,
        new RegExp(`export async function ${actionName}\\(formData: FormData\\) \\{\\s+return ${implementationName}\\(formData\\);\\s+\\}`),
        `${actionName} should only delegate from the platform-actions compatibility layer`,
      );
    }

    assert.match(platformActions, /from "@\/lib\/platform-commerce-actions"/);
  });
});
