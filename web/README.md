# NeuroPlatform Web

This is the frontend shell for the new platform phase.

It now sits in front of:

- `core/` for main business APIs
- `worker/` for outbox-driven async tasks

Current surface includes:

- Linux Do OIDC login
- dashboard and wallet overview
- dashboard reputation summary + breakdown + recent snapshots (module-gated)
- dashboard mission deck + check-in claim entry (module-gated)
- agent registry page with agent / capability create flows (module-gated)
- agent registry page now shows external callback secret hints for `sourceType=external` agents (module-gated), including rotate-related metadata from AgentView (`externalCallbackRotatedAt`) when available from `core`
- agent registry page now also shows external callback protocol/secret versions and supports owner-driven callback protocol updates
- agent registry page surfaces previous protocol versions and their grace deadlines so owners know the legacy protocol stays valid until the cutoff
- agent registry page now also shows `externalCallbackProtocolWindowState / externalCallbackSecretWindowState`, so owners can see whether a compatibility window is still active, already expired, or fully cleared
- agent registry page now surfaces recent callback configuration history for each external agent so owners can trace protocol/secret changes without leaving the console
- agent registry page now renders remediation policy details (`autoReplayStoredPayload / fallbackRetryRequestEnabled / fallbackRetryRequestCategories`) and uses a controlled policy selector instead of free-text input
- `/agents` and `/my-agents` now read the live callback remediation policy catalog from `GET /v1/agents/callback-remediation-policies`, so policy filters/selectors stay aligned with the real template directory instead of hardcoded option lists
- `/agents` now also renders health-driven remediation-policy switch recommendations for external agents, so old protocol/secret pressure, rejected callbacks, and duplicate-heavy slices can directly suggest `aggressive / balanced / safe_retry` changes
- agent registry page now reads progression access from `account-api /v1/me`; when the progression snapshot is unavailable it fails closed on level-gated create actions instead of assuming access is allowed
- agent callback operator page now exposes compatibility buckets (`byProtocolMatch` / `bySecretMatch`), highlights per-entry protocol/secret match flags, and adds `protocolMatch` / `secretMatch` filters in addition to the `callbackVersion` filter for targeted diagnostics
- agent callback operator page now also renders recent platform execution run history from `/v1/internal/agent-executions/runs`, including `platform_executor / recovery / requeue` records plus current execution phase/progress
- agent callback operator page now also surfaces failed-run aggregates (`failedCount`, `byExecutionPhase`, `byFailureCategory`) so operators can spot stale-timeout clusters and executor failures without reading every row
- agent callback operator page now also surfaces recent run windows (`15m / 1h / 24h`) so operators can tell whether failures are spiking right now or merely historical backlog
- operator filters on `/ops/agent-callbacks` now include `failureCategory` and `recentWindow`, so the run list/summary can be narrowed to slices like recent `stale_timeout` or `executor_failure`
- `/ops/agent-callbacks` now also supports `agentId` filtering, so callback audits and execution runs can be narrowed to a single external agent during governance/debug work
- `/ops/agent-callbacks` now also renders summary-driven recommended actions, so operators can one-click recovery, executor ticks, or prefiltered failure inspection based on the current run summary
- `/ops/agent-callbacks` now also renders callback governance recommendations from the audit summary itself, so previous protocol hits, previous secret hits, and duplicate callback pressure become direct operator playbooks
- `/ops/agent-callbacks` now also renders callback compatibility summary data from `/v1/internal/agents/callback-compatibility/summary`, including active/expired grace-window counts and a manual cleanup action
- `/ops/agent-callbacks` now also renders runtime session diagnostics (`state / kind / staleOnly`, phase timeout, phase age, overdue state) via `/v1/internal/agent-executions/runtime-sessions`
- when `/ops/agent-callbacks` is scoped to an `agentId`, it now also shows the callback configuration timeline from `/v1/internal/agents/:agentId/callback-history`, tying current compatibility hits back to concrete `secret_rotated` / `protocol_updated` events and grace windows
- `/agents` now renders per-agent callback governance hints for external agents and links directly into the matching `/ops/agent-callbacks` filtered slices for previous protocol, previous secret, or duplicate callback inspection
- recovery / executor actions on `/ops/agent-callbacks` now redirect back into matching follow-up filters, so the operator immediately lands on the affected `runKind + recentWindow` slice instead of a generic full list
- when stale timeout pressure and queued executions coexist, `/ops/agent-callbacks` now exposes a one-click combo playbook that runs recovery first and then a platform executor tick, with the usual follow-up redirect into the recent run slice
- agent execution page with execution session list/create/status transitions (module-gated)
- agent execution page now renders a requeue button whenever core reports `canRequeue`, and the server action redirects back with the usual status banner
- agent execution page now surfaces the phased platform executor runtime state (executor phase and progress percent) when the platform runtime is handling a queue item
- arbitration page (`/arbitrations`) with case create/list/status/evidence shell (module-gated)
- opinion topic list / create / support / oppose / archive / adopt page (module-gated)
- development roadmap page with queue status transitions for adopted topics (module-gated)
- products and items
- `/ops/fulfillment` now surfaces manual review workload capacity (`capacity / remainingCapacity / atCapacity / atCapacityCount`) and makes `claimNextEta = capacity_blocked` explicit in the operator queue
- `/ops/fulfillment` now also renders workload snapshot history from `ManualReviewWorkloadView.history`, so operators can compare recent manual/auto rebalance effects instead of only seeing the current queue state
- redemption
- mailbox
- marketplace
- task hub
- agent execution lifecycle page (`/agent-executions`) following `agentExecution` + `agentRegistry` gates
- agent execution artifacts: list display + per-execution artifact submit form (`kind/title/url/summary`)
- task hub agent proposals (module-gated by `taskHub` + `agentRegistry`)
- task hub creator actions for proposals: accept / reject and linked execution session creation
- task create flow supports `preferredCapabilityCodes` and proposal-level capability matching display
- product purchase with optional `discountCode` input
- task lifecycle controls (`start` / `submit` / `accept` / `default` / `cancel`) with graceful fallback messaging when `core` API is not ready
- redeem action now redirects with `status/message` banners on both success and failure, avoiding server-action 500 pages for normal business rejections

## Theme

The UI uses the local Modern Gradient design system:

- `../design-system/stylekit-modern-gradient/RULES.md`
- `../design-system/stylekit-modern-gradient/theme.css`

## Product Docs

- `../docs/README.md`
- `../docs/10-platform/NeuroLoom平台总基线.md`

## Development

1. Copy `.env.example` to `.env.local`
2. Fill in the Linux Do OAuth values
3. Set `ACCOUNT_INTERNAL_URL`, `CORE_INTERNAL_URL`, `INTERNAL_API_TOKEN`, and `REDIS_URL` to match the local stack
4. For local container testing without external OAuth, set `DEV_AUTH_BYPASS_ENABLED=true`
4. Install dependencies with `npm install`
5. Run `npm run dev`

## Notes

- Main platform state is now expected to live in `core` on PostgreSQL / Redis
- `web` acts as the frontend shell plus Linux Do auth entry
- dashboard reputation and mission cards are hidden automatically when their feature modules are disabled
- mission deck follows the unified `personalMissions` module gate and degrades safely when account APIs are unavailable
- opinions page degrades safely when `wallet / ledger` are closed: browsing stays available, create/support actions are disabled
- dashboard wallet cards degrade safely when wallet API fails: the page remains available and shows an availability notice
- agents page follows the `agentRegistry` module gate and only exposes owner-scoped data
- agents page only renders callback secret preview metadata for external agents; full secret is not echoed in list UI
- agent execution page follows `agentExecution` gate and only allows owner-scoped execution creation/status updates via core
- external agent callback supports both legacy routes (`status` / `artifacts`) and generic routes (`callback` / `heartbeat`)
- callback authentication uses `x-external-agent-secret`, callback requests require `x-external-callback-id`, and also include `x-external-callback-timestamp` plus `x-external-callback-signature` to validate the canonical payload; Redis still handles callbackId-level dedupe
- owner can rotate external callback secret via `POST /v1/agents/:agentId/rotate-callback-secret`; `web` consumes the resulting AgentView metadata and shows the full replacement secret through a one-shot Redis-backed flash token
- operator can access `/ops/outbox` to inspect dead-letter events and manually retry them when `PLATFORM_OPERATOR_USER_IDS` includes the current user
- `/ops/outbox` now also supports `queueStatus / eventName` filtering, batch retry via `POST /v1/internal/outbox-events/retry-batch`, and summary-driven operator recommendations for dead-letter cleanup plus pending/processing backlog inspection
- outbox summary now also exposes `oldestPendingAgeHours`, `topDeadLetterEvents`, and `recommendations`, in addition to replay history from `GET /v1/internal/outbox-events/retries`
- operator can access `/ops/agent-callbacks` to inspect external callback audits, summary buckets, callback versions, secret versions, and recent platform execution run history
- agent callback ops summary now exposes compatibility buckets (`byProtocolMatch` / `bySecretMatch`) and highlights when each audit used the previous protocol/secret, with optional `callbackVersion` filtering
- callback audit summary now also exposes `byRejectionCategory` and `byRetryability`, so the operator can separate retriable timestamp/conflict problems from inspect-only secret/version drift and non-retriable payload issues
- `/ops/agent-callbacks` also exposes a manual `run-platform-executor` action so operators can force a platform executor tick after recovery instead of waiting for the worker interval
- `/ops/agent-callbacks` also exposes a manual stale-platform-execution recovery action that calls `POST /v1/internal/agent-executions/recover-stale`
- `/ops/agent-callbacks` now also exposes per-audit retry-request actions for rejected callbacks, backed by `POST /v1/internal/agent-executions/callback-audits/:auditId/request-retry`; this records a `callback_retry_request` run instead of pretending to replay a raw callback payload that the platform does not store
- `/ops/agent-callbacks` now also supports `retryability` filtering plus batch retry-request remediation via `POST /v1/internal/agent-executions/callback-audits/request-retry-batch`, so retryable rejected callbacks can be handled in one operator action
- callback retry-request runs now expose `callbackAuditId`, and the rejected callback list marks audits that already had a retry request recorded within the recent operator slice
- callback retry-request dedupe now keys off the persisted `callback audit <auditId>` run summary, so a completed retry-request run still blocks duplicate remediation during the 15-minute window
- callback audits now also persist a replay-safe payload envelope and expose `replayPayloadStored`, enabling first-pass real payload replay for retryable rejected callbacks
- `/ops/agent-callbacks` now also exposes per-audit stored payload replay via `POST /v1/internal/agent-executions/callback-audits/:auditId/replay-payload`, writing `callback_payload_replay` runs and marking audits that were already replayed in the recent slice
- executor now also auto-calls `POST /v1/internal/agent-executions/callback-audits/auto-remediate`, so retryable rejected callbacks with stored payloads can produce `callback_auto_remediation` runs before an operator intervenes
- skipped auto-remediation candidates now also write back `lastAutoRemediationAt / nextAutoRemediationAt / autoRemediationLastError`, so policy-disabled, duplicate, or otherwise ineligible callbacks move into a scheduled cooldown instead of being rescanned every worker tick
- `/ops/agent-callbacks` now also renders callback remediation summary data (`candidateCount / replayPayloadStoredCount / nextDueAt / byRetryability / byAutoRemediationState`), so operators can see the actual remediation backlog instead of inferring it from raw rejected rows
- `/ops/agent-callbacks` now also classifies automatic remediation blockers into stable skip/failure reason buckets and shows those labels on rejected callbacks, so operators can separate policy-disabled backlog from duplicate cooldowns, missing stored payloads, target-unavailable conflicts, and real replay failures
- `/ops/agent-callbacks` now also supports `autoRemediationReasonCategory / autoRemediationReasonDisposition` filters and renders remediation-playbook recommendations from the summary itself, so operators can jump directly into `missing_payload / policy_disabled / attempt_failed` slices before using batch retry or per-audit replay tools
- `/ops/agent-callbacks` now also renders operator-facing remediation alerts (`byAlertLevel / maxAlertLevel / alerts`) with `L1-L3` hotspot cards, so callback backlog can be triaged by failure severity before dropping into reason/policy slices
- executor now also auto-calls `POST /v1/internal/agent-executions/callback-audits/emit-alerts`, and `/ops/agent-callbacks` exposes a manual dispatch action to backfill the same alert-to-mailbox path on demand
- `account-worker` now also supports outbound webhook delivery for `agentExecution.callbackRemediationAlerted`; the default payload remains vendor-neutral JSON, and operators can explicitly switch to `slack`, `discord`, or `feishu` compatible payloads via `NOTIFICATION_WEBHOOK_FORMAT`
- the same callback remediation webhook path now also supports first-pass route matching via `NOTIFICATION_WEBHOOK_ROUTES`, so L3 / policy-specific / reason-specific alerts can be sent to dedicated channels before falling back to the default webhook URL
- route matching now also supports `count / candidateCount / reasonDisposition / callbackType / stopAfterMatch`, so one alert can fan out from a primary channel to a second escalation channel when backlog density crosses a threshold
- routed callback remediation paging now also supports `minActiveMinutes / cooldownMinutes / maxDeliveriesPerIncident`, so external notifications can wait for persistence, avoid rapid repeats, and stop after a bounded number of deliveries per incident
- callback remediation paging now also supports reusable `NOTIFICATION_WEBHOOK_ROUTE_PROFILES`, so routes can inherit provider/cadence defaults via `profileKey` instead of copying the full policy into every webhook target
- `/ops/agent-callbacks` now also renders a sanitized paging catalog from `account-api /v1/internal/notification-webhooks/catalog`, so operators can inspect the active default target, route profiles, and resolved routes without exposing full webhook URLs or secrets
- `/ops/agent-callbacks` now also renders Redis-backed paging incidents from `account-api /v1/internal/notification-webhooks/incidents`, so operators can inspect `lastSentAt / sendCount / cooldownRemainingMinutes / deliveriesRemaining / currentState` per route and verify that the default fallback actually sent
- `/ops/agent-callbacks` now also supports incident lifecycle controls for callback remediation paging, so operators can mark hotspots as acknowledged, silence external paging for a bounded window, and clear that silence without losing the underlying incident state
- silenced incidents now suppress outbound webhook delivery in `account-worker` until `silencedUntil` expires or the operator clears the silence
- `/ops/agent-callbacks` now also renders recent paging incident history, so operators can audit `delivered / acknowledged / silenced / silence_cleared` events without dropping to Redis
- `clear-silence` now preserves the operator actor in paging incident history, instead of only resetting the current silence fields
- `/ops/agent-callbacks` now also renders incident slice summaries (`active / acknowledged / silenced / byAlertLevel / byReasonCategory`), so batch actions can be scoped against the current hotspot distribution instead of only a raw incident count
- `/ops/agent-callbacks` now also supports batch acknowledge / silence / clear-silence for the current incident slice, and those batch actions operate on the most recently seen incidents first
- the same incident slice now also supports `incidentReasonDisposition / incidentAlertLevel` filters end-to-end, so operators can batch lifecycle actions against only `failed` incidents or only `L2/L3` paging hotspots without widening back to the full slice
- `/ops/agent-callbacks` now also supports persistent paging incident saved views via `account-api /v1/internal/notification-webhooks/incidents/views*`, so operators can save/apply/default reusable incident slices instead of rebuilding the same paging filters from scratch
- saved view cards on `/ops/agent-callbacks` now also expose direct batch playbooks for that stored slice, so operators can acknowledge, silence for 60 minutes, or clear silence on the view-defined hotspot without first reapplying the filters manually
- those incident saved views now also persist playbook defaults (`batchLimit / silenceDurationMinutes / preferredAction`), so the saved-view quick actions use per-slice defaults instead of always falling back to a global `10 / 60m`
- those saved-view playbook defaults now also persist `silenceReasonTemplate`, so silence actions can write a stable operator-facing audit reason instead of falling back to a generic saved-view label
- those saved-view playbook defaults now also persist `followUpIncidentState`, so a saved-view action can return operators to a preferred `active / acknowledged / silenced` incident slice instead of always using the action's built-in redirect state
- those saved-view playbook defaults now also persist `focusSection`, so applying a saved view or running its playbook can land operators on a preferred `/ops/agent-callbacks` subsection such as `Paging Incidents`, `Incident Batch`, `Callback Audit Log`, or `Execution Run Watch`
- those saved-view playbook defaults now also persist `operatorGuidance`, so an incident slice can carry its own operator-facing playbook notes, escalation criteria, and silence guidance directly on the saved-view card and the default-view banner
- the saved-view card now also exposes `preferredAction` as a one-click primary playbook action, while keeping explicit override buttons for `acknowledge / silence / clear-silence`
- saved-view cards on `/ops/agent-callbacks` can now also be overwritten from the currently active incident slice, so operators can retarget an existing paging view without deleting and recreating it
- `/ops/agent-callbacks` now also supports editing an existing incident saved view from the top form, so operators can update the saved view name/description/default/playbook defaults while simultaneously replacing its slice with the currently active incident filters
- `clear-silence` now behaves as a no-op for incidents that were never silenced, so the incident timeline no longer gains fake `silence_cleared` entries
- callback operator actions now preserve `callbackVersion / secretVersion` filters during retry/replay/remediation redirects, and batch retry now respects those version filters instead of widening to the full rejected set
- worker now also auto-calls `POST /v1/internal/agents/callback-compatibility/cleanup-expired`, so expired protocol/secret grace windows are swept even without an operator visiting the console
- `/ops/agent-callbacks` also consumes `GET /v1/internal/agent-executions/runs` and `/summary` so operators can confirm whether recovery/watchdog actions actually wrote new run records and what execution state those runs currently point to
- `/ops/agent-callbacks` now also renders settlement summary, recent settlement attempts, and per-execution settlement retry actions alongside callback/runtime data
- failed run rows now carry a stable `failureCategory` derived in `core`, avoiding UI-side parsing of raw error strings
- operator can access `/ops/fulfillment` to process service-item manual reviews and inspect `routingCode / routingSummary / suggestedAction`, now with hooks to filter reviews by status or reason
- `/ops/fulfillment` now also supports `claim-next` and workload telemetry, so operators can auto-claim the highest-priority open review and inspect by-assignee queue pressure
- fulfillment ops summary now surfaces manual review reason buckets plus `resolvedLast7Days` throughput and `byResolutionAction` distribution so operators can track recent handling trends
- `/ops/fulfillment` now also renders summary-driven operator playbooks for urgent queue pressure, usage-audit queues, pool-health anomalies, and missing scheduled sweep activity
- fulfillment ops summary now also includes recent reconcile windows (`24h / 7d`) plus recent run logs, and `/ops/fulfillment` exposes `runTrigger / runStatus / runWindow` filters so operators can inspect background sweep activity directly
- `/ops/fulfillment` now also renders SLA summary, queue rebalance controls, and explicit assignee assignment in addition to `claim-next` / workload telemetry
- `/ops/fulfillment` now also exposes SLA auto-assignment, breached-unclaimed counts, and recommended automatic assignments derived from current workload pressure
- `/ops/fulfillment` recommended automatic assignments now also expose `routingCode / policySource / templateKey`, so operators can tell whether a recommendation came from a routing-specific pool, a template policy, or the global pool
- `/ops/fulfillment` now also exposes template strategy cards from `ManualReviewWorkloadView.templates`, and `claim-next / rebalance / auto-assign-sla` all accept `templateKey`
- `/ops/fulfillment` now also renders anomaly alert summary (`alertedCount / lastAlertedAt / byAlertLevel`) and exposes a manual anomaly escalation trigger
- `/ops/fulfillment` now also renders anomaly policy buckets/cards and per-anomaly `policyKey / escalationStrategy / nextEscalationAt`
- fulfillment queue actions now preserve the current review/run filters during claim, release, resolve, `claim-next`, and stale-release redirects
- arbitrations page follows `arbitration` gate, supports task-linked case create/list, and status transition buttons when `canUpdateStatus` is true
- arbitrations/tasks pages now surface `reputationImpactForViewer` and current task-level arbitration counts
- arbitrations page supports `resolved` 时提交 `taskResolutionAction`（`none/accept/default/cancel`），用于驱动任务结算动作
- arbitrations page now also consumes `GET /v1/arbitrations/cases/summary`, renders summary cards for operator-facing status / reputation impact buckets, and exposes status / resolution action / impact filters
- arbitration cases now carry a first-pass `timeline` assembled from created/evidence/review/resolution/effects-applied milestones, and `/arbitrations` renders that timeline inline for each case
- arbitration create/update actions now preserve the current filter slice (`caseStatus / taskResolutionAction / impact`) after redirect
- arbitrations page now renders structured evidence objects and allows case participants/operators to append `text_note / external_link / log_excerpt / screenshot_ref` evidence while the case remains open
- arbitrations page now also surfaces evidence-aware summary cards and supports `hasEvidence / evidenceKind` filters for operator slicing
- arbitrations page now also supports operator claim/release workflow and `claimed / unclaimed / mine` filtering
- `/arbitrations` now also renders operator workload, `claim-next`, and per-case `claimAgeHours / isStaleClaim`
- `/arbitrations` now also surfaces `remoteAttachmentCount / archivedRemoteAttachmentCount`, review-round `roundAgeHours / isRoundStale`, and arbitration auto-release policy visibility
- arbitrations page now also supports evidence attachment upload/download; each structured evidence can show its attachment repository and downloads are proxied through `/api/arbitration-attachments/:attachmentId`
- arbitration evidence attachments now support `local / remote` storage modes in `core`; the web download path remains the same proxy route
- arbitrations page now also renders multi-round review state (`currentReviewRoundNumber / reviewRounds`) and supports operator round advancement while the case remains `under_review`
- arbitrations page now also renders remote cleanup queue policy, failed cleanup counts, per-candidate cleanup attempts/errors, and `request-cleanup / archive` operator actions
- arbitration attachment cards now also render `uploadState`, prepared/completed timestamps, and retention / cleanup-request state
- roadmap page follows the `developmentQueue` module gate and only allows queue owner to push status transitions
- tasks page supports preferred capability codes input/render and proposal match info render when available from core
- agent execution page supports execution artifacts render and artifact submission via platform action
- agent execution page now also renders callback audit metadata (`callbackVersion / secretVersion / callbackTimestamp`)
- agent execution page also exposes execution run logs (`runs`) so owners/operators can trace platform executor attempts and failure summaries
- agent execution page now also renders per-run cost, per-execution total cost, and cost-by-run-kind buckets from `AgentExecutionView.totalCostUnits / costByRunKind`
- `/agent-executions` now also renders step-level cost profile: `totalStepCostUnits / costByStepKind / estimatedRemainingCostUnits`, plus per-step `costUnits`
- `/agent-executions` now also renders runtime budget status, resource minutes, and estimated amount from `AgentExecutionView.costSummary` plus run-level `resourceMinutes / estimatedAmount`
- `/agent-executions` now also renders first-pass settlement state: `status / billedAmount / revenueAmount / lastAttemptAt / lastError`
- `/agent-executions` now also renders settlement pricing snapshot (`pricingPolicyKey / pricingPolicyVersion / treasuryUserId`) alongside line items
- agent execution page now supports `runtimeProfileKey` at creation time and renders `runtimeProfile / targetArtifactCount / maxAutoRecoveryCount` on execution cards
- `/agent-executions` now reads the live runtime catalog from `GET /v1/agent-executions/runtime-catalog`, so runtime profile selectors and create-time guidance stay aligned with the actual runtime profile directory and utilization data
- `/agent-executions` now also reads the live callback remediation policy catalog from `GET /v1/agents/callback-remediation-policies`, so create/update selectors and policy detail cards no longer rely on hardcoded policy option lists
- `/agent-executions` now also renders execution-level callback policy source/override metadata plus health-driven override recommendations, so external executions can be nudged toward a temporary override or back to `inherit_agent` without changing the whole linked Agent
- `/agent-executions` now also supports owner-scoped launch presets through `GET/POST /v1/agent-executions/presets`, so repeated `preferredAgent / runtimeProfile / callback policy / title/objective template` combinations can be reused instead of re-entered every time
- launch preset cards now support apply/edit/delete, and can directly create an execution when the preset includes a usable preferred agent plus filled title/objective templates
- launch presets now also support `POST /v1/agent-executions/presets/:presetId/default`, and `/agent-executions` auto-applies the owner's default preset when no explicit `presetId` query is present
- launch presets now also persist `followUpExecutionStatus` and `focusSection`, so a preset can decide both the default execution-status slice and the default `/agent-executions` subsection after apply/create/quick-launch
- launch presets now also persist `followUpRunKind`, so a preset can decide which execution run slice should be shown after create/quick-launch instead of only filtering by execution status
- launch presets now also persist `followUpRunStatus`, so a preset can further narrow the post-launch run slice to `running / completed / failed`
- launch presets now also persist `followUpFailureCategory`, so a preset can further narrow failed run follow-up to `stale_timeout / executor_failure / requeue_failure / unknown_failure`
- launch presets now also persist `followUpRecentWindow`, so a preset can additionally narrow post-launch run follow-up to the recent `15m / 1h / 24h` slice
- launch presets now also persist `followUpCallbackStatus`, `followUpCallbackRetryability`, `followUpCallbackType`, and `followUpCallbackRejectionCategory`, so a preset can narrow the callback audit backlog shown inside each execution card to a specific remediation slice after create or quick-launch
- launch presets now also persist `followUpReplayPayloadCompatibility` and `followUpReplayPayloadReplayable`, so a preset can narrow callback backlog follow-up to replay-compatible or directly replayable payload slices
- launch presets now also persist `followUpDecisionClass` and `followUpReplayFailureClass`, so a preset can further narrow callback follow-up to a specific remediation decision path or replay failure taxonomy slice
- launch presets now also persist `followUpRuntimeDecisionClass` and `followUpRuntimeDecisionSeverity`, so a preset can route owners directly into a specific runtime decision slice rather than only broad execution status or run filters
- launch presets now also persist `followUpPressureLevel` and `followUpSchedulingDecisionClass`, so a preset can route owners directly into the `Cost Overview` runtime-pressure slice instead of only execution or callback backlog views
- the `Active Launch Preset` panel now also renders `Runtime Guidance` derived from the live runtime catalog, so pressure slices become direct owner playbooks (`continue launch / inspect runtime sessions / adjust preset / review cost overview`) instead of passive filter state
- when `Runtime Guidance` recommends a lighter runtime profile, the active preset panel now also exposes a one-click adopt action, so the owner can switch the preset profile immediately instead of going back through the full edit form
- `/agent-executions` now also threads `runtimeProfileKey` through launch-preset apply/create/quick-launch/runtime-guidance redirects, so `Runtime Sessions`, `Cost Overview`, and the execution list land on the active preset's own runtime-profile slice instead of a full cross-profile view
- `Runtime Sessions`, `Cost Overview`, and the execution list now all expose explicit `runtimeProfileKey` filters, and the runtime-session section also shows a profile-scoped slice summary when that filter is active
- the `Active Launch Preset` panel now also renders a structured `Runtime Playbook`, so saturation / owner-hotspot / queue-backlog states map to explicit next steps (`adjust preset / inspect runtime sessions / inspect execution backlog / inspect cost overview`) instead of a single generic CTA
- when a launch preset also defines callback follow-up filters, that `Runtime Playbook` now adds a direct callback-backlog step and preserves the same `runtimeProfileKey` plus callback remediation slice (`status / retryability / type / rejection / replay payload / decision / replay failure`)
- the `Active Launch Preset` panel now also renders `Callback Guidance` and a small callback playbook derived from the preset's own callback follow-up slice, so owners can see profile-scoped counts (`rejected / replayable rejected / invalid payload / inspect`) and jump straight into replayable or incompatible callback backlog instead of only scanning raw callback cards
- that callback guidance now also exposes dominant `decisionClass` and `replayFailureClass` buckets, and can route owners directly into compat-window / compatibility-policy / replay-failure slices instead of only broad callback backlog views
- owner callback guidance/playbook now also surfaces the shared slice `preferredActionKind`, and when a slice is better handled through operator actions it adds a direct `/ops/agent-callbacks` bridge link instead of leaving owners to reconstruct the same remediation slice manually
- `/agent-executions` and `/ops/agent-callbacks` now also reuse the same `decisionClass / replayFailureClass` option and label helpers, so owner and operator remediation slices no longer drift into different naming schemes
- `/ops/agent-callbacks` now also reuses the same shared remediation-slice helper as `/agent-executions`, so owner/operator now agree not only on labels but also on which slice should be prioritized first (`compat window / compatibility policy / replayable backlog / replay failure hotspot / incompatible payload`)
- `/ops/agent-callbacks` callback audit filters now also support `replayPayloadCompatibility / replayPayloadReplayable`, and those replay-payload slices now carry through callback summaries, remediation summaries, batch retry/auto-remediation actions, and follow-up redirects
- that shared remediation-slice helper now also carries `preferredActionKind`, so `/ops/agent-callbacks` can execute slice-scoped `inspect / auto-remediate / request-retry-batch` actions directly from the shared playbook cards instead of treating every slice as a plain link
- `/ops/agent-callbacks` shared remediation cards now also reuse the same callback bridge plan as the owner-side callback playbook, so action slices become `primary operator action + secondary inspect fallback` instead of three separate per-action rendering branches
- `/ops/agent-callbacks` now also renders a `Shared Runtime Guidance` card inside the runtime-pressure section, and it reuses the same runtime guidance/playbook helper as `/agent-executions` instead of maintaining a separate operator-only hotspot heuristic
- that shared runtime helper now also standardizes the action labels (`launch / sessions / backlog / preset / cost`) across owner and operator surfaces, and its playbook can bridge either into `/agent-executions` or back into the current operator anchors (`Runtime Sessions / Execution Run Watch / Callback Audits`) while preserving the active runtime-profile context
- that operator-side runtime playbook now also uses a structured runtime bridge plan, so steps explicitly resolve to `ops-action / ops-slice / owner-bridge` primary CTAs and action steps keep a secondary inspect fallback instead of rendering ad-hoc buttons from raw step keys
- that shared runtime playbook can now also inject a direct `emit runtime alerts` step when the current pressure slice still has `L2/L3` alert candidates but no active paging incident coverage, so operators no longer have to rebuild the same pressure filters in the manual alert-dispatch form
- when the current pressure slice already has runtime paging incident coverage, that same shared runtime playbook now swaps to an `inspect runtime incidents` step and jumps directly into the matching `Paging Incidents` slice instead of prompting a redundant alert dispatch
- that `inspect runtime incidents` step is now state-aware and opens the most relevant `active / acknowledged / silenced` incident slice instead of always dropping the operator into the wide incident list
- that same runtime playbook now also reacts to runtime-incident governance state: it can append `acknowledge runtime incidents` for active coverage, `silence runtime incidents` when multiple active incidents are stacking on the same pressure slice, keep acknowledged-only low-volume coverage in an observation path, escalate that acknowledged coverage to `silence runtime incidents` only after it keeps piling up, and `clear runtime incident silence` for silenced coverage; all lifecycle actions still go straight through the existing batch incident endpoints instead of forcing the operator to rebuild the slice first
- acknowledged and silenced coverage now also change playbook ordering: acknowledged coverage promotes the incident-inspection step to the front of the playbook, while silenced coverage promotes `clear runtime incident silence` before the normal backlog/session follow-up
- acknowledged and silenced coverage now also expose explicit lifecycle routing: low-volume acknowledged slices add `observe runtime incidents`, and acknowledged/silenced slices can add `handoff runtime incidents` so the operator can bridge directly into `Runtime Sessions / Execution Backlog / Callback Backlog / Cost Overview` without rebuilding the same runtime hotspot context
- that `handoff runtime incidents` step now also distinguishes `handoff` from `escalate`, so acknowledged/silenced hotspots that keep growing can surface a stronger escalation CTA instead of the same neutral bridge label
- those acknowledged / silenced slices now also append an explicit `incident follow-up` step instead of leaving the operator to infer the next jump: owner hotspots prefer `Runtime Sessions`, queue/profile saturation prefers `Execution Backlog`, callback-enabled slices can bridge into `Callback Backlog`, and otherwise the playbook falls back to `Cost Overview`
- `/agent-executions` now also consumes that runtime lifecycle for operator-capable owners: it reads the matching runtime alert / incident slice when available, shows `observe / handoff / escalate` badges in the owner-side `Runtime Playbook`, bridges incident-facing steps into `/ops/agent-callbacks`, and keeps the rest of the follow-up inside the owner's local `Runtime Sessions / Execution Backlog / Callback Backlog / Cost Overview` flow
- that owner-side runtime playbook now also consumes the structured runtime bridge plan itself, so each step resolves `owner-bridge / ops-slice / ops-action` primary/secondary CTAs before rendering and no longer relies on ad-hoc per-step button branching
- the owner-side `Runtime Guidance` card now also follows that same bridge model: its primary CTA stays on the owner-local follow-up, while runtime alert / incident coverage can add a secondary `ops-bridge` CTA into `/ops/agent-callbacks` `Runtime Pressure / Paging Incidents`
- owner relief typed handoff defaults now also persist `followUpFocusSection`, and `/ops/agent-callbacks` uses that value both when opening the default next hop and when showing the current handoff-session badge, so the operator can see which subsection a handoff will land on before opening it
- owner relief typed handoff defaults now also persist `followUpProfile`, and `/ops/agent-callbacks` uses it to rewrite handoff CTA semantics into `inspect only / resolve after review / reopen after review` instead of leaving every handoff as the same generic open button
- owner relief handoff cards now also switch their primary CTA by session lifecycle: `pending` keeps open-first, `opened` promotes `resolve / reopen` when the profile requires it, and `resolved / reopened` drop back to audit-style inspection
- those handoff lifecycle CTAs are now target-aware as well, so `runtime pressure / execution run watch / runtime session watch / callback audit slice` each render a different follow-up label instead of sharing one generic “open handoff” action
- that guidance card now also renders explicit `owner-bridge / ops-slice` target badges, so the owner can tell at a glance whether the action stays in `/agent-executions` or bridges into the operator surface
- when that owner-side runtime handoff targets `Callback Backlog` and the active callback guidance already prefers `auto-remediate` or `request-retry-batch`, the owner-side runtime playbook now upgrades its CTA copy to that operator remediation action instead of only showing a generic callback-backlog bridge
- that callback-backlog escalation now also keeps two explicit bridge results in the owner UI: a primary operator remediation CTA and a secondary owner-local callback backlog CTA, so the user can distinguish “go execute the ops action” from “inspect the backlog first”
- that owner-side callback escalation is now also modeled as a structured handoff profile (`inspect_only / operator_action_auto_remediate / operator_action_retry_batch`) instead of relying only on CTA copy, which keeps the bridge semantics stable as the runtime playbook keeps growing
- the owner-side `Callback Guidance / Callback Playbook` now reuses that same callback bridge plan, so primary/secondary CTA ordering and the `owner-local / ops-bridge` target badge come from one shared helper instead of separate per-panel conditionals
- runtime session summary now also exposes `oldestStaleStartedAt`, `openByKind`, `openByState`, and structured recommendations, so `/ops/agent-callbacks` can render a real `Runtime Session Playbook` instead of only four summary counters
- that runtime-session playbook can now route operators directly into stale session inspection, owner-requeue/stale-recovery/failed slices, or a terminal-open sweep flow without rebuilding the same filters by hand
- those runtime-session recommendations now also expose a shared `actionKind`, so the operator surface shows stable `inspect / sweep` CTA badges instead of relying only on ad-hoc button copy
- launch presets now also persist `followUpRuntimeSessionKind`, so a preset can route owners into the `Runtime Sessions` subsection with a preselected `platform_executor / stale_recovery / owner_requeue` slice
- launch presets now also persist `followUpRuntimeSessionState`, so a preset can route owners into the `Runtime Sessions` subsection with a preselected `running / completed / failed / requeued` state slice
- launch presets now also persist `launchGuidance`, so an active preset can carry its own launch note directly into the create-execution section instead of leaving that context only in the card list
- `/agent-executions` now also renders a fixed `Active Launch Preset` panel, so the currently applied preset's guidance, preferred agent, runtime profile, callback policy, and follow-up behavior stay visible even after leaving the preset list
- the `/agent-executions` execution list now also supports `runKind + runStatus + failureCategory + recentWindow` filtering, and active presets can automatically route owners into that run slice while narrowing each execution card to matching run records
- the `/agent-executions` launch-preset flow now supports the first follow-up focus set: `active-preset`, `launch-presets`, `create-execution`, `runtime-sessions`, `cost-overview`, and `execution-list`
- agent execution page now also renders runtime session summary and a manual session-sweep action for operator users
- owner execution run cards are now typed against both plain execution runs and operator-enriched runs, avoiding a build-time prop mismatch between `/agent-executions` and `/ops/agent-callbacks`
- maintained_pool / warranty_delivery first version is wired into product and asset surfaces, including item-unit issue reporting, independent fulfillment records, fulfillment run history, and reconcile metadata (`items.lastReconciledAt`)
- products and ops fulfillment pages now surface manual review routing metadata, filterable review queues, and `rejectionSummary` for service assets
- ops fulfillment manual review page now embeds the operator ops summary (`/items/ops-summary`) so rejection-code buckets and fulfillment run trigger/status breakdowns are visible alongside the manual queue data
- platform-sourced agent executions may be auto-claimed by `worker` through the internal platform executor loop; this is a baseline execution plane, not the final agent runtime
- `web` 目前可参考文档中的 worker 重试/死信控制和 service-item 后台 reconcile 巡检的说明，用于解释为何通知/履约数据会在后台重跑以保障服务一致性
- Payment-related routes, pages, and bridge code have been removed for now

## Still Missing

- Callback governance:
  - richer remediation policy templates on top of current auto-remediation loops
- richer paging escalation policy on top of the current generic/provider-friendly routed webhook sink
- Execution runtime:
  - deeper runtime beyond the current baseline phase/progress loop
  - clearer separation between owner subtasks and runtime-managed sessions
- Fulfillment review queue:
  - assignee-aware queue governance and SLA automation
  - deeper stale-claim and workload balancing policies

## This Round

- `/agent-executions` now shows settlement line items.
- `/ops/fulfillment` now shows fulfillment anomaly summary and recent anomalies.
- `/arbitrations` now shows cleanup-requested remote attachments and stale review round signals.
