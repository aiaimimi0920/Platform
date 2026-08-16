export type ArbitrationCaseFilters = {
  caseIdFilter: string;
  caseStatusFilter: string;
  taskResolutionActionFilter: string;
  impactFilter: string;
  evidenceKindFilter: string;
  hasEvidenceFilter: string;
  assignmentFilter: string;
};

export function renderArbitrationFollowUpFields(args: {
  caseId?: string | null;
  caseStatus?: string | null;
  taskResolutionAction?: string | null;
  impact?: string | null;
  evidenceKind?: string | null;
  hasEvidence?: string | null;
  assignment?: string | null;
  routePath?: string | null;
}) {
  return (
    <>
      {args.caseId ? <input type="hidden" name="followUpCaseId" value={args.caseId} /> : null}
      {args.caseStatus ? <input type="hidden" name="followUpCaseStatus" value={args.caseStatus} /> : null}
      {args.taskResolutionAction ? (
        <input type="hidden" name="followUpTaskResolutionAction" value={args.taskResolutionAction} />
      ) : null}
      {args.impact ? <input type="hidden" name="followUpImpact" value={args.impact} /> : null}
      {args.evidenceKind ? <input type="hidden" name="followUpEvidenceKind" value={args.evidenceKind} /> : null}
      {args.hasEvidence ? <input type="hidden" name="followUpHasEvidence" value={args.hasEvidence} /> : null}
      {args.assignment ? <input type="hidden" name="followUpAssignment" value={args.assignment} /> : null}
      {args.routePath ? <input type="hidden" name="followUpRoutePath" value={args.routePath} /> : null}
    </>
  );
}
