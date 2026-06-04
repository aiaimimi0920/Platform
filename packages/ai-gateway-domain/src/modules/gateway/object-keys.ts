export function buildGatewayProviderAccountObjectKey(providerAccountId: string) {
  return `ai-gateway/provider-account/${providerAccountId}.json`;
}

export function buildGatewayRuntimeSessionObjectKey(sessionId: string) {
  return `ai-gateway/runtime-session/${sessionId}.json`;
}

export function buildGatewayRequestArtifactObjectKey(requestAuditId: string, kind: "request" | "response") {
  return `ai-gateway/request-audits/${requestAuditId}/${kind}.json`;
}

export function buildGatewayAnalysisExportPrefix(exportId: string) {
  return `ai-gateway/analysis-exports/${exportId}`;
}

export function buildGatewayAnalysisExportObjectKey(exportId: string, fileName: string) {
  return `${buildGatewayAnalysisExportPrefix(exportId)}/${fileName}`;
}

export function buildGatewayAnalysisExportManifestObjectKey(exportId: string) {
  return buildGatewayAnalysisExportObjectKey(exportId, "manifest.json");
}

export function buildGatewayAnalysisExportDatasetObjectKey(exportId: string) {
  return buildGatewayAnalysisExportObjectKey(exportId, "dataset.jsonl");
}

export function buildGatewayAnalysisRemediationEffectivenessSnapshotPrefix(snapshotId: string) {
  return `ai-gateway/remediation-effectiveness-snapshots/${snapshotId}`;
}

export function buildGatewayAnalysisRemediationEffectivenessSnapshotObjectKey(snapshotId: string) {
  return `${buildGatewayAnalysisRemediationEffectivenessSnapshotPrefix(snapshotId)}/snapshot.json`;
}

export function buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotPrefix(snapshotId: string) {
  return `ai-gateway/remediation-effectiveness-anomaly-snapshots/${snapshotId}`;
}

export function buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotObjectKey(snapshotId: string) {
  return `${buildGatewayAnalysisRemediationEffectivenessAnomalySnapshotPrefix(snapshotId)}/snapshot.json`;
}

export function buildGatewayRateLimitHotspotSnapshotPrefix(snapshotId: string) {
  return `ai-gateway/rate-limit-hotspot-snapshots/${snapshotId}`;
}

export function buildGatewayRateLimitHotspotSnapshotObjectKey(snapshotId: string) {
  return `${buildGatewayRateLimitHotspotSnapshotPrefix(snapshotId)}/snapshot.json`;
}

export function buildGatewayRateLimitHotspotAnomalySnapshotPrefix(snapshotId: string) {
  return `ai-gateway/rate-limit-hotspot-anomaly-snapshots/${snapshotId}`;
}

export function buildGatewayRateLimitHotspotAnomalySnapshotObjectKey(snapshotId: string) {
  return `${buildGatewayRateLimitHotspotAnomalySnapshotPrefix(snapshotId)}/snapshot.json`;
}
