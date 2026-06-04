alter table gateway_request_audits
  add column if not exists analysis_profile jsonb,
  add column if not exists request_artifact_object_key text,
  add column if not exists response_artifact_object_key text;
