import type { ApiErrorCode } from "@neuro/contracts";

export class HttpError extends Error {
  statusCode: number;
  code: ApiErrorCode;
  moduleKey?: string;

  constructor(statusCode: number, code: ApiErrorCode, message: string, moduleKey?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.moduleKey = moduleKey;
  }
}

export class ModuleDisabledError extends HttpError {
  constructor(moduleKey: string, message = `Module ${moduleKey} is disabled`) {
    super(503, "MODULE_DISABLED", message, moduleKey);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, "BAD_REQUEST", message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string) {
    super(401, "UNAUTHORIZED", message);
  }
}
