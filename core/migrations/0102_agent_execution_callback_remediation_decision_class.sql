alter table agent_execution_callback_remediations
  add column if not exists planned_decision_class text;
