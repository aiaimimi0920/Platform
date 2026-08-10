import type { PublicSurfaceSnapshot } from "@neuro/contracts";

import { DependencyState } from "@/components/dependency-state";
import type { DependencyResult } from "@/lib/dependency-result";

export function PublicSurfaceDependencyState({
  result,
}: {
  result: DependencyResult<PublicSurfaceSnapshot>;
}) {
  return (
    <main className="app-page">
      <div className="nt-shell" style={{ paddingBlock: 32 }}>
        <DependencyState label="公开入口配置" result={result} />
      </div>
    </main>
  );
}
