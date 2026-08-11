-- ============================================================
-- Wallet authentication transition
-- Adds password hashes and private server-side sessions without breaking
-- the legacy frontend during the controlled migration.
-- IMPORTANT: plaintext password columns are removed only after the frontend
-- has been switched to the private Edge Function.
-- ============================================================

create extension if not exists pgcrypto;

alter table public.users
  add column if not exists password_hash text;

alter table public.clients
  add column if not exists password_hash text;

-- Backfill password hashes. The original password is temporarily retained so
-- the existing application keeps working until the server login is deployed.
update public.users
set password_hash = extensions.crypt(password, extensions.gen_salt('bf', 10))
where password_hash is null
  and password is not null
  and btrim(password) <> '';

update public.clients
set password_hash = extensions.crypt(password, extensions.gen_salt('bf', 10))
where password_hash is null
  and password is not null
  and btrim(password) <> '';

-- Keep the hash synchronized while the legacy password field still exists.
create or replace function public.wallet_hash_legacy_password()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.password is null or btrim(new.password) = '' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.password_hash is null then
      new.password_hash := extensions.crypt(new.password, extensions.gen_salt('bf', 10));
    end if;
  elsif new.password is distinct from old.password or new.password_hash is null then
    new.password_hash := extensions.crypt(new.password, extensions.gen_salt('bf', 10));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_hash_legacy_password on public.users;
create trigger trg_users_hash_legacy_password
before insert or update of password on public.users
for each row execute function public.wallet_hash_legacy_password();

drop trigger if exists trg_clients_hash_legacy_password on public.clients;
create trigger trg_clients_hash_legacy_password
before insert or update of password on public.clients
for each row execute function public.wallet_hash_legacy_password();

-- Opaque sessions used only by the Wallet Edge Function.
create table if not exists public.wallet_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  actor_type text not null
    check (actor_type in ('operator', 'client')),
  user_id text references public.users(id) on delete cascade,
  client_id text references public.clients(id) on delete cascade,
  actor_role text not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint wallet_auth_sessions_actor_check check (
    (actor_type = 'operator' and user_id is not null and client_id is null)
    or
    (actor_type = 'client' and client_id is not null and user_id is null)
  ),
  constraint wallet_auth_sessions_expiry_check check (
    expires_at > created_at
  )
);

create index if not exists idx_wallet_auth_sessions_active_token
  on public.wallet_auth_sessions(token_hash, expires_at)
  where revoked_at is null;

create index if not exists idx_wallet_auth_sessions_user
  on public.wallet_auth_sessions(user_id)
  where user_id is not null;

create index if not exists idx_wallet_auth_sessions_client
  on public.wallet_auth_sessions(client_id)
  where client_id is not null;

-- Authentication audit trail. It stores hashes of identifiers/IPs instead of
-- raw values so failed-login monitoring does not create another PII leak.
create table if not exists public.wallet_auth_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'login_success',
    'login_failure',
    'logout',
    'session_revoked',
    'rate_limited'
  )),
  actor_type text check (actor_type in ('operator', 'client')),
  actor_id text,
  identifier_hash text check (
    identifier_hash is null or identifier_hash ~ '^[0-9a-f]{64}$'
  ),
  ip_hash text check (
    ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'
  ),
  session_id uuid references public.wallet_auth_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_auth_events_identifier_created
  on public.wallet_auth_events(identifier_hash, created_at desc)
  where identifier_hash is not null;

create index if not exists idx_wallet_auth_events_ip_created
  on public.wallet_auth_events(ip_hash, created_at desc)
  where ip_hash is not null;

-- Server-only credential checks. They return identity data, never hashes or
-- password values.
create or replace function public.wallet_verify_operator_credentials(
  p_username text,
  p_password text
)
returns table (
  actor_id text,
  actor_name text,
  actor_role text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    u.id,
    u.full_name,
    u.role
  from public.users u
  where lower(btrim(u.username)) = lower(btrim(p_username))
    and u.status = 'Activo'
    and u.password_hash is not null
    and u.password_hash = extensions.crypt(p_password, u.password_hash)
  limit 1;
$$;

create or replace function public.wallet_verify_client_credentials(
  p_code text,
  p_password text
)
returns table (
  actor_id text,
  actor_name text,
  actor_role text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.name,
    'Cliente'::text
  from public.clients c
  where upper(btrim(c.code)) = upper(btrim(p_code))
    and c.password_hash is not null
    and c.password_hash = extensions.crypt(p_password, c.password_hash)
  limit 1;
$$;

-- Session and audit tables are private. Only Edge Functions using the
-- service_role may read or write them.
alter table public.wallet_auth_sessions enable row level security;
alter table public.wallet_auth_events enable row level security;

revoke all on public.wallet_auth_sessions from anon, authenticated;
revoke all on public.wallet_auth_events from anon, authenticated;

revoke all on function public.wallet_verify_operator_credentials(text, text)
  from public, anon, authenticated;

revoke all on function public.wallet_verify_client_credentials(text, text)
  from public, anon, authenticated;

grant all on public.wallet_auth_sessions to service_role;
grant all on public.wallet_auth_events to service_role;

grant execute on function public.wallet_verify_operator_credentials(text, text)
  to service_role;

grant execute on function public.wallet_verify_client_credentials(text, text)
  to service_role;

comment on column public.users.password_hash is
  'Temporary transition hash used by the private wallet authentication service.';

comment on column public.clients.password_hash is
  'Temporary transition hash used by the private wallet authentication service.';

comment on table public.wallet_auth_sessions is
  'Opaque private sessions for Wallet API access. Raw bearer tokens are never stored.';

comment on table public.wallet_auth_events is
  'Authentication audit trail using hashed identifiers and IP addresses.';
