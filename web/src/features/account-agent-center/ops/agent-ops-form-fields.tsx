export type AgentCallbackFollowUpArgs = {
  agentId?: string | null;
  ownerUserId?: string | null;
  callbackType?: string | null;
  callbackVersion?: string | number | null;
  secretVersion?: string | number | null;
  status?: string | null;
  remediationPolicyKey?: string | null;
  protocolMatch?: string | null;
  secretMatch?: string | null;
  retryability?: string | null;
  rejectionCategory?: string | null;
  executionStatus?: string | null;
  recentWindow?: string | null;
  runtimeState?: string | null;
  runtimeKind?: string | null;
  runtimeStaleOnly?: string | null;
  runKind?: string | null;
  runStatus?: string | null;
  fragment?: string | null;
};

export type AgentCallbackAutomationArgs = {
  agentId?: string | null;
  callbackType?: string | null;
  remediationPolicyKey?: string | null;
  callbackVersion?: string | number | null;
  secretVersion?: string | number | null;
  protocolMatch?: string | null;
  secretMatch?: string | null;
  retryability?: string | null;
  rejectionCategory?: string | null;
};

export type RuntimeSessionActionArgs = {
  agentId?: string | null;
  ownerUserId?: string | null;
  runtimeState?: "running" | "completed" | "failed" | "requeued" | null;
  runtimeKind?: "platform_executor" | "stale_recovery" | "owner_requeue" | null;
  runtimeStaleOnly?: "true" | "false" | null;
};

export function renderCallbackFollowUpFields(args: AgentCallbackFollowUpArgs) {
  return (
    <>
      {args.agentId ? (
        <input type="hidden" name="followUpAgentId" value={args.agentId} />
      ) : null}
      {args.ownerUserId ? (
        <input
          type="hidden"
          name="followUpOwnerUserId"
          value={args.ownerUserId}
        />
      ) : null}
      {args.callbackType ? (
        <input
          type="hidden"
          name="followUpCallbackType"
          value={args.callbackType}
        />
      ) : null}
      {args.callbackVersion !== null && args.callbackVersion !== undefined ? (
        <input
          type="hidden"
          name="followUpCallbackVersion"
          value={String(args.callbackVersion)}
        />
      ) : null}
      {args.secretVersion !== null && args.secretVersion !== undefined ? (
        <input
          type="hidden"
          name="followUpSecretVersion"
          value={String(args.secretVersion)}
        />
      ) : null}
      {args.status ? (
        <input
          type="hidden"
          name="followUpCallbackStatus"
          value={args.status}
        />
      ) : null}
      {args.remediationPolicyKey ? (
        <input
          type="hidden"
          name="followUpRemediationPolicyKey"
          value={args.remediationPolicyKey}
        />
      ) : null}
      {args.protocolMatch ? (
        <input
          type="hidden"
          name="followUpProtocolMatch"
          value={args.protocolMatch}
        />
      ) : null}
      {args.secretMatch ? (
        <input
          type="hidden"
          name="followUpSecretMatch"
          value={args.secretMatch}
        />
      ) : null}
      {args.retryability ? (
        <input
          type="hidden"
          name="followUpRetryability"
          value={args.retryability}
        />
      ) : null}
      {args.rejectionCategory ? (
        <input
          type="hidden"
          name="followUpRejectionCategory"
          value={args.rejectionCategory}
        />
      ) : null}
      {args.executionStatus ? (
        <input
          type="hidden"
          name="followUpExecutionStatus"
          value={args.executionStatus}
        />
      ) : null}
      {args.recentWindow ? (
        <input
          type="hidden"
          name="followUpRecentWindow"
          value={args.recentWindow}
        />
      ) : null}
      {args.runtimeState ? (
        <input
          type="hidden"
          name="followUpRuntimeState"
          value={args.runtimeState}
        />
      ) : null}
      {args.runtimeKind ? (
        <input
          type="hidden"
          name="followUpRuntimeKind"
          value={args.runtimeKind}
        />
      ) : null}
      {args.runtimeStaleOnly ? (
        <input
          type="hidden"
          name="followUpRuntimeStaleOnly"
          value={args.runtimeStaleOnly}
        />
      ) : null}
      {args.runKind ? (
        <input type="hidden" name="followUpRunKind" value={args.runKind} />
      ) : null}
      {args.runStatus ? (
        <input
          type="hidden"
          name="followUpRunStatus"
          value={args.runStatus}
        />
      ) : null}
      {args.fragment ? (
        <input type="hidden" name="followUpFragment" value={args.fragment} />
      ) : null}
    </>
  );
}

export function renderCallbackAutomationFields(args: AgentCallbackAutomationArgs) {
  return (
    <>
      {args.agentId ? (
        <input type="hidden" name="agentId" value={args.agentId} />
      ) : null}
      {args.callbackType ? (
        <input type="hidden" name="callbackType" value={args.callbackType} />
      ) : null}
      {args.remediationPolicyKey ? (
        <input
          type="hidden"
          name="remediationPolicyKey"
          value={args.remediationPolicyKey}
        />
      ) : null}
      {args.callbackVersion !== null && args.callbackVersion !== undefined ? (
        <input
          type="hidden"
          name="callbackVersion"
          value={String(args.callbackVersion)}
        />
      ) : null}
      {args.secretVersion !== null && args.secretVersion !== undefined ? (
        <input
          type="hidden"
          name="secretVersion"
          value={String(args.secretVersion)}
        />
      ) : null}
      {args.protocolMatch ? (
        <input
          type="hidden"
          name="protocolMatch"
          value={args.protocolMatch}
        />
      ) : null}
      {args.secretMatch ? (
        <input type="hidden" name="secretMatch" value={args.secretMatch} />
      ) : null}
      {args.retryability ? (
        <input type="hidden" name="retryability" value={args.retryability} />
      ) : null}
      {args.rejectionCategory ? (
        <input
          type="hidden"
          name="rejectionCategory"
          value={args.rejectionCategory}
        />
      ) : null}
    </>
  );
}

export function renderRuntimeSessionActionFields(args: RuntimeSessionActionArgs) {
  return (
    <>
      {args.agentId ? (
        <input type="hidden" name="agentId" value={args.agentId} />
      ) : null}
      {args.ownerUserId ? (
        <input type="hidden" name="ownerUserId" value={args.ownerUserId} />
      ) : null}
      {args.runtimeState ? (
        <input type="hidden" name="state" value={args.runtimeState} />
      ) : null}
      {args.runtimeKind ? (
        <input type="hidden" name="kind" value={args.runtimeKind} />
      ) : null}
      {args.runtimeStaleOnly ? (
        <input type="hidden" name="staleOnly" value={args.runtimeStaleOnly} />
      ) : null}
    </>
  );
}
