# Account Domain Migrations

This directory is reserved for account-domain specific schema migrations.

Rules:

- New account-owned table or column changes should land here by default.
- The runner is `npm run db:migrate --workspace @neuro/account-domain`.
- The runner uses `ACCOUNT_DATABASE_URL` when provided and falls back to `DATABASE_URL`.
- Applied files are recorded in `account_schema_migrations`.

Current boundary:

- Historical shared-schema migrations still live under `core/migrations/`.
- This directory is the forward path for account-domain specific evolution; it does not imply the whole account surface is already fully split from the shared database.
- `20260324_00_account_schema_bootstrap.sql` is the bootstrap batch for account-owned runtime tables:
  `feature_modules / users / auth_identities / outbox_events / ledger_* / mailbox_* / daily_* / weekly_* / reputation_*`
- The bootstrap batch also creates the minimum local `products / items / item_units` shadow tables required for account-side mailbox item grants in dedicated-db mode.
- `20260324_01_account_read_indexes.sql` then adds the first read-focused index batch for mailbox, wallet ledger, reputation history, and daily rewards so the independent runner carries real forward changes instead of an empty scaffold.
- `20260325_00_mailbox_archive_alert_subscriptions.sql` adds operator-owned mailbox subscription rules for archive anomaly routing, keeping the delivery preferences inside account-domain instead of hard-coding them in worker/env lists.
- `20260325_01_mailbox_archive_alert_digests.sql` extends those subscription rules with `immediate / digest` delivery modes and creates the digest queue/state table flushed by `account-worker`.
- `20260325_02_mailbox_archive_alert_digest_flush_runs.sql` persists digest flush run history so worker/manual flush health can be surfaced in `/ops/products` without relying on transient logs.
- `20260325_03_mailbox_archive_alert_digest_queue_ops.sql` adds digest queue operation fields (`dismissed_* / last_flush_*`) so operators can retry or dismiss stuck digests from `/ops/products`.
- `20260325_05_notification_webhook_incident_saved_views.sql` adds operator-owned saved views/default pointers for callback remediation paging incidents, so `/ops/agent-callbacks` can persist reusable incident slices inside account-domain instead of relying on ad-hoc query strings.
- `20260325_06_notification_webhook_incident_saved_view_playbook_defaults.sql` extends those incident saved views with operator playbook defaults (`batchLimit / silenceDurationMinutes / preferredAction`), so a saved slice can carry its own reusable batch action profile.
- `20260325_07_mailbox_archive_alert_ops_playbooks.sql` adds operator-owned archive anomaly playbooks/default pointers, so `/ops/account-worker` and `/ops/products` can persist reusable worker playbooks inside account-domain instead of relying only on short-lived cookies.
- `20260325_08_mailbox_archive_alert_ops_playbook_runs.sql` adds playbook run/action audit tables, so reopening a saved archive playbook creates a fresh run and later digest/archive/subscription actions can write back execution history plus latest backlog snapshots.
- `20260326_00_mailbox_archive_alert_ops_playbook_run_results.sql` extends those run rows with explicit closure results (`resolved / abandoned / handed_off`), completion metadata, and result-status indexing so `/ops/products` can close a run while `/ops/account-worker` filters recent runs by closure state.
- `20260326_01_mailbox_archive_alert_ops_playbook_run_handoff_reopen.sql` adds explicit `handoff_target` plus `reopened_from_run_id / superseded_by_run_id`, so a handed-off run records who should take over and a reopened run forms a durable audit chain instead of relying on UI-only links.
- `20260326_02_mailbox_archive_alert_ops_playbook_handoff_target_type.sql` adds `handoff_target_type`, so handed-off runs can be grouped by a stable target category in `/ops/account-worker` instead of relying only on free-form text.
- `20260326_03_mailbox_archive_alert_handoff_default_playbooks.sql` adds `mailbox_archive_alert_handoff_default_playbooks`, so typed handoff targets can resolve to an operator-owned default playbook/action profile instead of relying on ad-hoc next-step decisions.
- `20260326_04_personal_missions.sql` adds the unified `personal_mission_definitions / personal_mission_claims` tables, seeds the first personal mission catalog, and migrates development-era签到/日常/周常领取记录 out of the retired `daily_* / weekly_*` tables.
- `20260327_01_mailbox_favorites_and_delete.sql` adds `mailbox_messages.favorited_at` plus prune-friendly indexes, so mailbox favorites can pin to the top of the inbox while automatic overflow cleanup skips favorited mail instead of deleting it first.
- `20260327_08_agent_execution_owner_relief_handoff_follow_up_profile.sql` extends owner-relief typed handoff defaults and handoff sessions with `follow_up_profile`, so `/ops/agent-callbacks` can persist whether a handoff is inspect-only, should be resolved after review, or is expected to reopen owner relief after the follow-up.
