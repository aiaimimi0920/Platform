import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { isPlatformOperatorUserId } from "./notification-webhook-catalog";

const originalOperatorUserIds = process.env.PLATFORM_OPERATOR_USER_IDS;

afterEach(() => {
  if (originalOperatorUserIds === undefined) {
    delete process.env.PLATFORM_OPERATOR_USER_IDS;
  } else {
    process.env.PLATFORM_OPERATOR_USER_IDS = originalOperatorUserIds;
  }
});

test("recognizes platform operators by provider user id", () => {
  process.env.PLATFORM_OPERATOR_USER_IDS = "local-dev-account";

  assert.equal(isPlatformOperatorUserId("internal-user-id", "local-dev-account"), true);
});

test("recognizes platform operators by internal user id", () => {
  process.env.PLATFORM_OPERATOR_USER_IDS = "internal-user-id";

  assert.equal(isPlatformOperatorUserId("internal-user-id", "local-dev-account"), true);
});

test("rejects users whose internal and provider ids are not configured operators", () => {
  process.env.PLATFORM_OPERATOR_USER_IDS = "operator-a,operator-b";

  assert.equal(isPlatformOperatorUserId("internal-user-id", "local-dev-account"), false);
});
