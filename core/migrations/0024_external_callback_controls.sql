alter table agents add column if not exists external_callback_rotated_at timestamptz null;
alter table agent_executions add column if not exists last_external_callback_at timestamptz null;
alter table agent_executions add column if not exists last_heartbeat_at timestamptz null;
