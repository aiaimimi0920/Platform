alter table auth_identities
  add column if not exists verified_at timestamptz;

alter table auth_identities
  add column if not exists is_primary boolean not null default false;

alter table auth_identities
  add column if not exists email_invocation_enabled boolean not null default false;

alter table auth_identities
  add column if not exists email_delivery_enabled boolean not null default false;

alter table auth_identities
  add column if not exists last_used_at timestamptz;

update auth_identities
set verified_at = coalesce(verified_at, created_at)
where provider = 'linuxdo'
  and verified_at is null;

create unique index if not exists auth_identities_email_primary_idx
  on auth_identities(user_id)
  where provider = 'email' and is_primary = true;

create index if not exists auth_identities_user_provider_idx
  on auth_identities(user_id, provider, created_at desc);

create table if not exists email_identity_verifications (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  email text not null,
  normalized_email text not null,
  verification_code_hash text not null,
  mark_as_primary boolean not null default false,
  status text not null,
  attempt_count integer not null default 0,
  requested_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists email_identity_verifications_user_email_idx
  on email_identity_verifications(user_id, normalized_email, requested_at desc);

create index if not exists email_identity_verifications_status_expires_idx
  on email_identity_verifications(status, expires_at, requested_at desc);

create table if not exists email_delivery_jobs (
  id text primary key,
  user_id text references users(id) on delete set null,
  email_identity_id text references auth_identities(id) on delete set null,
  purpose text not null,
  recipient_email text not null,
  subject text not null,
  text_body text not null,
  html_body text,
  reference_type text,
  reference_id text,
  status text not null,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists email_delivery_jobs_reference_idx
  on email_delivery_jobs(reference_type, reference_id)
  where reference_type is not null and reference_id is not null;

create index if not exists email_delivery_jobs_status_created_idx
  on email_delivery_jobs(status, created_at desc);

create table if not exists email_native_inbound_messages (
  id text primary key,
  user_id text references users(id) on delete set null,
  email_identity_id text references auth_identities(id) on delete set null,
  from_email text not null,
  normalized_from_email text not null,
  to_email text not null,
  normalized_to_email text not null,
  provider_message_id text,
  idempotency_key text not null,
  subject text,
  text_body text not null,
  html_body text,
  route_kind text,
  status text not null,
  rejection_reason text,
  created_task_id text,
  created_execution_id text,
  received_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index if not exists email_native_inbound_messages_idempotency_idx
  on email_native_inbound_messages(idempotency_key);

create index if not exists email_native_inbound_messages_user_created_idx
  on email_native_inbound_messages(user_id, created_at desc);

create index if not exists email_native_inbound_messages_execution_idx
  on email_native_inbound_messages(created_execution_id, created_at desc);

create index if not exists email_native_inbound_messages_task_idx
  on email_native_inbound_messages(created_task_id, created_at desc);
