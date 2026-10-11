-- Fresh OIDC accounts only. Do not link or modify legacy auth_identities.
create table oidc_identities (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  issuer text not null check (char_length(issuer) between 1 and 2048),
  subject text not null check (char_length(subject) between 1 and 255),
  display_name text check (display_name is null or char_length(display_name) between 1 and 128),
  email text check (email is null or char_length(email) between 1 and 254),
  email_verified boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_login_at timestamptz not null,
  constraint oidc_identities_verified_email_check check (not email_verified or email is not null)
);

create unique index oidc_identities_issuer_subject_idx on oidc_identities(issuer, subject);
create index oidc_identities_user_idx on oidc_identities(user_id);
