import type { ArbitrationCaseView, ArbitrationWorkloadView } from "@neuro/contracts";
import { DependencyState } from "@/components/dependency-state";
import { Card } from "@/components/ui/card";
import type { DependencyResult } from "@/lib/dependency-result";
import { ArbitrationCaseCard } from "@/features/arbitration-center/owner/arbitration-case-card";
import type { ArbitrationCaseFilters } from "@/features/arbitration-center/shared/arbitration-follow-up-fields";

export function ArbitrationCaseListSection({
  filteredCases,
  casesUnavailable,
  casesDependency,
  currentUserId,
  showOperatorMetadata,
  isOperator,
  arbitrationApiReady,
  arbitrationWorkload,
  filters,
  routePath,
}: {
  filteredCases: ArbitrationCaseView[];
  casesUnavailable: boolean;
  casesDependency: DependencyResult<unknown> | undefined;
  currentUserId: string;
  showOperatorMetadata: boolean;
  isOperator: boolean;
  arbitrationApiReady: boolean;
  arbitrationWorkload: ArbitrationWorkloadView | null;
  filters: ArbitrationCaseFilters;
  routePath: string;
}) {
  return (
    <Card className="app-stack">
      <p className="mg-subtitle">案件</p>
      <h2 className="app-card-title">仲裁案件列表</h2>
      {filteredCases.length === 0 ? (
        casesUnavailable && casesDependency ? (
          <DependencyState label="仲裁案件" result={casesDependency} />
        ) : (
          <p className="mg-copy">当前没有仲裁案件。</p>
        )
      ) : (
        <div className="app-task-list">
          {filteredCases.map((arbitrationCase) => (
            <ArbitrationCaseCard
              arbitrationApiReady={arbitrationApiReady}
              arbitrationCase={arbitrationCase}
              arbitrationWorkload={arbitrationWorkload}
              currentUserId={currentUserId}
              filters={filters}
              isOperator={isOperator}
              key={arbitrationCase.id}
              routePath={routePath}
              showOperatorMetadata={showOperatorMetadata}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
