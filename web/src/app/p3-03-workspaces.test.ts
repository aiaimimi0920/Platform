import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("P3-03: mailbox is a direct message workspace with a preserved deep-link contract", () => {
  const pageSource = read("./mailbox/page.tsx");
  const routeSource = read("../features/mailbox/routes.ts");
  const shellSource = read("../components/app-shell.tsx");

  assert.match(pageSource, /<h1[\s\S]*邮箱/);
  assert.match(pageSource, /MailboxCenter/);
  assert.match(pageSource, /workspace/);
  assert.match(pageSource, /getPublicSurfaceSnapshotStrict/);
  assert.match(routeSource, /messageId/);
  assert.match(routeSource, /buildMailboxRouteHref/);
  assert.match(shellSource, /isMailboxWorkspaceRoute/);
});

test("P3-03: benefits is a direct workspace and applies family/service deep links", () => {
  const pageSource = read("./benefits/page.tsx");
  const benefitSource = read("../features/account-benefit-center/owner/benefit-center-container.tsx");
  const shellSource = read("../components/app-shell.tsx");

  assert.match(pageSource, /<h1[\s\S]*权益/);
  assert.match(pageSource, /BenefitCenter/);
  assert.match(pageSource, /workspace/);
  assert.match(pageSource, /getPublicSurfaceSnapshotStrict/);
  assert.match(benefitSource, /useSearchParams/);
  assert.match(benefitSource, /family/);
  assert.match(benefitSource, /serviceId/);
  assert.match(benefitSource, /resolveBenefitServiceSelection/);
  assert.match(benefitSource, /targetedService/);
  assert.match(benefitSource, /data-service-id/);
  assert.match(benefitSource, /resolveBenefitServiceDependency/);
  assert.match(benefitSource, /dependencyErrors/);
  assert.match(benefitSource, /targetedFamilyKeyRef\.current/);
  assert.match(benefitSource, /targetedServiceIdRef\.current/);
  assert.match(shellSource, /isBenefitsWorkspaceRoute/);
});

test("P3-03: my-arbitrations renders owner-scoped evidence without operator workload", () => {
  const pageSource = read("./my-arbitrations/page.tsx");
  const arbitrationSource = read("./arbitrations/page.tsx");
  const shellSource = read("../components/app-shell.tsx");
  const benefitSource = read("../features/account-benefit-center/owner/benefit-center-container.tsx");

  assert.match(pageSource, /renderArbitrationsWorkspace/);
  assert.match(pageSource, /ownerOnly/);
  assert.match(arbitrationSource, /ownerOnly/);
  assert.match(arbitrationSource, /caseIdFilter/);
  assert.match(arbitrationSource, /requesterUserId/);
  assert.match(arbitrationSource, /respondentUserId/);
  assert.match(arbitrationSource, /const isOperator = !ownerOnly/);
  assert.match(arbitrationSource, /isOperator && arbitrationClient\.getArbitrationCaseWorkload/);
  assert.match(arbitrationSource, /isOperator && arbitrationClient\.getArbitrationRemoteAttachmentCleanupQueue/);
  assert.match(arbitrationSource, /\{isOperator && arbitrationCase\.canAdvanceReviewRound/);
  assert.match(arbitrationSource, /\{isOperator && arbitrationCase\.canUpdateStatus/);
  assert.match(arbitrationSource, /const showOperatorMetadata = isOperator/);
  assert.match(arbitrationSource, /showOperatorMetadata \? \([\s\S]*name="assignment"/);
  assert.match(arbitrationSource, /showOperatorMetadata \? \([\s\S]*arbitrationCase\.assignedOperatorUserId/);
  assert.match(arbitrationSource, /showOperatorMetadata && attachment\.remoteUrl/);
  assert.match(arbitrationSource, /showOperatorMetadata && round\.isRoundStale/);
  assert.match(arbitrationSource, /showOperatorMetadata \? \([\s\S]*round\.assignedOperatorUserId/);
  assert.match(arbitrationSource, /formatOwnerSafeArbitrationActor/);
  assert.match(arbitrationSource, /formatArbitrationTimelineKind/);
  assert.match(shellSource, /"\/my-arbitrations"/);
  assert.doesNotMatch(benefitSource, /深链目标|定位服务/);
  const publicSurfaceFailureBranch = arbitrationSource.match(
    /if \(publicSurfaceResponse\.status === "rejected"\) \{([\s\S]*?)\n  \}/,
  )?.[1] ?? "";
  const featureFailureBranch = arbitrationSource.match(
    /if \(isFeatureSnapshotUnavailable\(features\)\) \{([\s\S]*?)\n  \}/,
  )?.[1] ?? "";
  assert.match(publicSurfaceFailureBranch, /<h1/);
  assert.match(publicSurfaceFailureBranch, /label="公开入口配置"/);
  assert.match(featureFailureBranch, /<h1/);
  assert.match(featureFailureBranch, /label="仲裁模块"/);
});
