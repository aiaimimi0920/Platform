CREATE TABLE IF NOT EXISTS agent_execution_owner_relief_run_handoffs (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES agent_execution_owner_relief_runs(id) ON DELETE CASCADE,
  operator_user_id text NOT NULL REFERENCES users(id),
  handoff_target_type text NOT NULL,
  handoff_target text NOT NULL,
  status text NOT NULL,
  latest_follow_up_href text,
  open_count integer NOT NULL DEFAULT 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  result_note text,
  completed_at timestamptz,
  completed_by_user_id text REFERENCES users(id),
  reopened_run_id text,
  reopened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_execution_owner_relief_run_handoffs_run_idx
  ON agent_execution_owner_relief_run_handoffs(run_id);

CREATE INDEX IF NOT EXISTS agent_execution_owner_relief_run_handoffs_operator_updated_idx
  ON agent_execution_owner_relief_run_handoffs(operator_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS agent_execution_owner_relief_run_handoffs_operator_status_idx
  ON agent_execution_owner_relief_run_handoffs(operator_user_id, status, updated_at DESC);
