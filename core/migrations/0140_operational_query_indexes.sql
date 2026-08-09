create index if not exists arbitration_cases_created_id_idx
  on arbitration_cases (created_at, id);

create index if not exists arbitration_cases_requester_created_id_idx
  on arbitration_cases (requester_user_id, created_at, id);

create index if not exists arbitration_cases_respondent_created_id_idx
  on arbitration_cases (respondent_user_id, created_at, id);

create index if not exists agent_execution_callbacks_received_idx
  on agent_execution_callbacks (received_at desc, id desc);
