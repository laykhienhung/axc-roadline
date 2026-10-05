-- Up Migration

create table plans (
  id bigint generated always as identity primary key,
  plan jsonb not null,
  file_name text not null,
  file bytea not null,
  template_version text,
  imported_at timestamptz not null default now(),
  imported_by text
);

create index plans_imported_at_idx on plans (imported_at desc);

create table value_mappings (
  kind text not null check (kind in ('status', 'quarter', 'due')),
  word text not null,
  meaning text not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (kind, word)
);

create table template_versions (
  version text primary key,
  first_seen_at timestamptz not null default now()
);

create table imports (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_email text,
  file_name text,
  file_size integer,
  outcome text not null check (
    outcome in (
      'ok',
      'invalid_plan',
      'needs_mapping',
      'invalid_mapping',
      'no_file',
      'file_too_large',
      'unsupported_type',
      'forbidden'
    )
  ),
  problems jsonb,
  plan_id bigint references plans (id) on delete set null
);

create index imports_at_idx on imports (at desc);
