import { env } from "../../env";
import { BadRequestError, ConflictError, HttpError, ModuleDisabledError, NotFoundError, UnauthorizedError } from "../../platform/errors";
import { TeaUpstreamError, createTeaClient } from "./client";

export function getDefaultTeaClient() {
  if (!env.teaServerUrl) {
    throw new ModuleDisabledError("tea", "Tea service is not configured");
  }

  return createTeaClient({
    baseUrl: env.teaServerUrl,
    authToken: env.teaAuthToken,
  });
}

export function toPlatformTeaError(error: unknown): Error {
  if (!(error instanceof TeaUpstreamError)) {
    return error instanceof Error ? error : new Error("Unknown Tea client error");
  }

  if (error.statusCode === 400) {
    return new BadRequestError(error.message);
  }
  if (error.statusCode === 401) {
    return new UnauthorizedError(error.message);
  }
  if (error.statusCode === 404) {
    return new NotFoundError(error.message);
  }
  if (error.statusCode === 409) {
    return new ConflictError(error.message);
  }

  return new HttpError(error.statusCode === 403 ? 403 : 502, "BAD_REQUEST", error.message);
}
