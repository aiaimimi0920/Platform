import { Auth } from "@auth/core";
import type { NextRequest } from "next/server";

import { authConfig } from "@/auth";
import { toAuthCoreRequest } from "@/lib/auth-core-request";

export function GET(request: NextRequest) {
  return Auth(toAuthCoreRequest(request), authConfig);
}

export function POST(request: NextRequest) {
  return Auth(toAuthCoreRequest(request), authConfig);
}
