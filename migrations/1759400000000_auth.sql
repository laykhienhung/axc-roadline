-- Up Migration

create table users (
  id bigint generated always as identity primary key,
  email text not null constraint users_email_key unique check (email = lower(email)),
  name text not null check (length(name) between 1 and 100),
  password_hash text not null,
  role text not null default 'viewer' check (role in ('viewer', 'editor', 'admin')),
  must_change_password boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  password_changed_at timestamptz
);

create table sessions (
  token_hash bytea primary key,
  user_id bigint not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text
);

create index sessions_user_id_idx on sessions (user_id);
create index sessions_expires_at_idx on sessions (expires_at);
