import { publicSurfaceKeys, type PublicSurfaceSnapshot } from "@neuro/contracts";

import { getPublicSurfaceSnapshotStrict } from "@/lib/core-client";
import {
  createDependencyFailureResult,
  createDependencyResult,
  type DependencyResult,
} from "@/lib/dependency-result";

type PublicSurfaceLoader = () => Promise<PublicSurfaceSnapshot>;

export function createClosedPublicSurfaceSnapshot(): PublicSurfaceSnapshot {
  const updatedAt = new Date().toISOString();
  return Object.fromEntries(
    publicSurfaceKeys.map((surfaceKey) => [
      surfaceKey,
      { surfaceKey, enabled: false, updatedAt },
    ]),
  ) as PublicSurfaceSnapshot;
}

export async function loadPublicSurfaceDependency(
  load: PublicSurfaceLoader = getPublicSurfaceSnapshotStrict,
): Promise<DependencyResult<PublicSurfaceSnapshot>> {
  try {
    return createDependencyResult({ state: "ready", data: await load() });
  } catch (error) {
    return createDependencyFailureResult({
      error,
      message: "公开入口配置暂不可用，请稍后再试。",
      source: "public-surfaces",
      unauthorizedMessage: "当前账户无权读取公开入口配置。",
    });
  }
}

export function hasPublicSurfaceSnapshot(
  result: DependencyResult<PublicSurfaceSnapshot>,
): result is Extract<DependencyResult<PublicSurfaceSnapshot>, { state: "ready" }> {
  return result.state === "ready";
}
