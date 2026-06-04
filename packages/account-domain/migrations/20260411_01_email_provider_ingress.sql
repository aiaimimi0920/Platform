create table if not exists email_provider_inbound_messages (
  id text primary key,
  provider text not null,
  provider_event_id text,
  provider_message_id text,
  idempotency_key text not null,
  processing_state text not null,
  from_email text not null,
  normalized_from_email text not null,
  to_email text not null,
  normalized_to_email text not null,
  subject text,
  text_body text not null,
  html_body text,
  attachment_count integer not null default 0,
  attachments_json text,
  provider_payload_json text,
  canonical_inbound_message_id text,
  canonical_inbound_status text,
  canonical_rejection_reason text,
  last_error text,
  received_at timestamptz not null,
  processed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists email_provider_inbound_messages_idempotency_idx
  on email_provider_inbound_messages(idempotency_key);

create index if not exists email_provider_inbound_messages_provider_event_idx
  on email_provider_inbound_messages(provider, provider_event_id, created_at desc);

create index if not exists email_provider_inbound_messages_processing_idx
  on email_provider_inbound_messages(processing_state, created_at desc);

create index if not exists email_provider_inbound_messages_canonical_idx
  on email_provider_inbound_messages(canonical_inbound_message_id, created_at desc);
