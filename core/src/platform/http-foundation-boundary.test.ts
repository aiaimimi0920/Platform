import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HttpError as sharedHttpError,
  UnauthorizedError as sharedUnauthorizedError,
} from "@neuro/backend-foundation/platform/errors";
import {
  platformCorsOrigin as sharedPlatformCorsOrigin,
  serializePlatformError as sharedSerializePlatformError,
} from "@neuro/backend-foundation/platform/http-server";

import {
  HttpError as coreHttpError,
  UnauthorizedError as coreUnauthorizedError,
} from "./errors";
import {
  platformCorsOrigin as corePlatformCorsOrigin,
  serializePlatformError as coreSerializePlatformError,
} from "./http-server";

describe("core HTTP foundation boundary", () => {
  it("reuses the backend-foundation error classes and HTTP helpers", () => {
    assert.equal(coreHttpError, sharedHttpError);
    assert.equal(coreUnauthorizedError, sharedUnauthorizedError);
    assert.equal(coreSerializePlatformError, sharedSerializePlatformError);
    assert.equal(corePlatformCorsOrigin, sharedPlatformCorsOrigin);

    const error = new coreUnauthorizedError("Invalid token");
    assert.equal(error instanceof sharedHttpError, true);
    assert.deepEqual(coreSerializePlatformError(error), {
      statusCode: 401,
      body: {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid token",
          moduleKey: undefined,
        },
      },
    });
  });
});
