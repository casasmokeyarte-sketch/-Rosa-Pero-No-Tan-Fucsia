-- ============================================================
-- NFC Wallet / Bolsillo digital - foundation
-- Closed-loop customer credit for purchases at the business.
-- This migration creates an immutable ledger and private NFC mapping.
-- Execute only after review in Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

-- One closed-loop wallet per client.
create table if not exists public.wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique references public.clients(id) on delete restrict,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  currency text not null default 'COP' check (currency = 'COP'),
  status text not null default 'active'
    check (status in ('active', 'blocked', 'closed')),
  savings_goal_name text,
  savings_goal_amount numeric(14,2) check (savings_goal_amount is null or savings_goal_amount > 0),
  pin_hash text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Physical cards contain/identify only an opaque token. Personal data and
-- balances always remain in Supabase.
create table if not exists public.nfc_cards (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete restrict,
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  uid_hash text unique,
  status text not null default 'active'
    check (status in ('active', 'blocked', 'replaced', 'revoked')),
  label text,
  issued_by_user_id text references public.users(id) on delete set null,
  replaced_by_card_id uuid references public.nfc_cards(id) on delete set null,
  issued_at timestamptz not null default now(),
  blocked_at timestamptz,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists uq_nfc_cards_one_active_per_client
  on public.nfc_cards(client_id)
  where status = 'active';

-- Payment attempts are separate from money. A pending/returned checkout must
-- never change a balance until the provider webhook confirms approval.
create table if not exists public.wallet_topup_intents (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'COP' check (currency = 'COP'),
  provider text not null default 'bold' check (provider in ('bold')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  order_reference text not null unique,
  idempotency_key text not null unique,
  payment_link_id text unique,
  payment_url text,
  provider_transaction_id text unique,
  provider_payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Immutable money ledger. Amount is always positive; direction controls
-- whether it increases or decreases the wallet.
create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_account_id uuid not null references public.wallet_accounts(id) on delete restrict,
  client_id text not null references public.clients(id) on delete restrict,
  direction text not null check (direction in ('credit', 'debit')),
  kind text not null check (kind in (
    'topup_cash',
    'topup_transfer',
    'topup_card',
    'topup_bold',
    'overpayment',
    'refund',
    'purchase',
    'adjustment_credit',
    'adjustment_debit',
    'reversal_credit',
    'reversal_debit'
  )),
  amount numeric(14,2) not null check (amount > 0),
  balance_after numeric(14,2) not null check (balance_after >= 0),
  source text not null check (source in (
    'cash',
    'transfer',
    'card',
    'bold',
    'wallet',
    'system'
  )),
  operator_user_id text references public.users(id) on delete set null,
  operator_name text,
  shift_id text references public.shifts(id) on delete set null,
  invoice_id text references public.invoices(id) on delete set null,
  topup_intent_id uuid references public.wallet_topup_intents(id) on delete set null,
  external_reference text,
  idempotency_key text not null unique,
  reversal_of uuid unique references public.wallet_transactions(id) on delete restrict,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_wallet_transactions_external_reference
  on public.wallet_transactions(external_reference)
  where external_reference is not null;

create index if not exists idx_wallet_transactions_client_created
  on public.wallet_transactions(client_id, created_at desc);

create index if not exists idx_wallet_transactions_shift
  on public.wallet_transactions(shift_id)
  where shift_id is not null;

create index if not exists idx_wallet_transactions_invoice
  on public.wallet_transactions(invoice_id)
  where invoice_id is not null;

create index if not exists idx_wallet_topup_intents_client_created
  on public.wallet_topup_intents(client_id, created_at desc);

create index if not exists idx_nfc_cards_client
  on public.nfc_cards(client_id);

-- Maintain updated_at consistently.
create or replace function public.wallet_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_wallet_accounts_updated_at on public.wallet_accounts;
create trigger trg_wallet_accounts_updated_at
before update on public.wallet_accounts
for each row execute function public.wallet_touch_updated_at();

drop trigger if exists trg_wallet_topup_intents_updated_at on public.wallet_topup_intents;
create trigger trg_wallet_topup_intents_updated_at
before update on public.wallet_topup_intents
for each row execute function public.wallet_touch_updated_at();

-- Automatically provision a zero-balance account for every client.
create or replace function public.wallet_provision_client_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.wallet_accounts (client_id)
  values (new.id)
  on conflict (client_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_wallet_provision_client_account on public.clients;
create trigger trg_wallet_provision_client_account
after insert on public.clients
for each row execute function public.wallet_provision_client_account();

insert into public.wallet_accounts (client_id)
select c.id
from public.clients c
on conflict (client_id) do nothing;

-- Ledger rows must never be edited or deleted. Corrections are represented by
-- a new reversal transaction linked to the original row.
create or replace function public.wallet_prevent_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Wallet ledger rows are immutable; create a reversal instead.';
end;
$$;

drop trigger if exists trg_wallet_transactions_no_update on public.wallet_transactions;
create trigger trg_wallet_transactions_no_update
before update on public.wallet_transactions
for each row execute function public.wallet_prevent_ledger_mutation();

drop trigger if exists trg_wallet_transactions_no_delete on public.wallet_transactions;
create trigger trg_wallet_transactions_no_delete
before delete on public.wallet_transactions
for each row execute function public.wallet_prevent_ledger_mutation();

-- Prevent ad-hoc balance edits. Only the atomic posting function sets a
-- transaction-local flag before changing the cached balance.
create or replace function public.wallet_protect_balance()
returns trigger
language plpgsql
as $$
begin
  if new.balance is distinct from old.balance
     and coalesce(current_setting('app.wallet_mutation', true), '') <> 'allowed' then
    raise exception 'Wallet balance cannot be edited directly.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_wallet_accounts_protect_balance on public.wallet_accounts;
create trigger trg_wallet_accounts_protect_balance
before update of balance on public.wallet_accounts
for each row execute function public.wallet_protect_balance();

-- Atomic and idempotent posting function. It serializes operations per wallet,
-- prevents negative balances and records the resulting balance in the ledger.
create or replace function public.wallet_post_transaction(
  p_client_id text,
  p_kind text,
  p_amount numeric,
  p_source text,
  p_idempotency_key text,
  p_operator_user_id text default null,
  p_shift_id text default null,
  p_invoice_id text default null,
  p_topup_intent_id uuid default null,
  p_external_reference text default null,
  p_reversal_of uuid default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.wallet_accounts%rowtype;
  v_existing public.wallet_transactions%rowtype;
  v_original public.wallet_transactions%rowtype;
  v_result public.wallet_transactions%rowtype;
  v_direction text;
  v_amount numeric(14,2);
  v_new_balance numeric(14,2);
  v_operator_name text;
begin
  if p_client_id is null or btrim(p_client_id) = '' then
    raise exception 'client_id is required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key is required';
  end if;

  v_amount := round(p_amount, 2);
  if v_amount is null or v_amount <= 0 then
    raise exception 'amount must be greater than zero';
  end if;

  if p_source not in ('cash', 'transfer', 'card', 'bold', 'wallet', 'system') then
    raise exception 'Unsupported wallet source: %', p_source;
  end if;

  if p_kind in (
    'topup_cash', 'topup_transfer', 'topup_card', 'topup_bold',
    'overpayment', 'refund', 'adjustment_credit', 'reversal_credit'
  ) then
    v_direction := 'credit';
  elsif p_kind in ('purchase', 'adjustment_debit', 'reversal_debit') then
    v_direction := 'debit';
  else
    raise exception 'Unsupported wallet transaction kind: %', p_kind;
  end if;

  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'Client not found: %', p_client_id;
  end if;

  insert into public.wallet_accounts (client_id)
  values (p_client_id)
  on conflict (client_id) do nothing;

  select *
  into v_account
  from public.wallet_accounts
  where client_id = p_client_id
  for update;

  select *
  into v_existing
  from public.wallet_transactions
  where idempotency_key = p_idempotency_key;

  if found then
    return v_existing;
  end if;

  if v_account.status <> 'active' then
    raise exception 'Wallet is not active for client %', p_client_id;
  end if;

  if p_reversal_of is not null then
    select *
    into v_original
    from public.wallet_transactions
    where id = p_reversal_of
    for update;

    if not found then
      raise exception 'Original wallet transaction not found';
    end if;

    if v_original.client_id <> p_client_id then
      raise exception 'Reversal client does not match original transaction';
    end if;

    if exists (
      select 1 from public.wallet_transactions where reversal_of = p_reversal_of
    ) then
      raise exception 'Transaction has already been reversed';
    end if;

    if p_kind not in ('reversal_credit', 'reversal_debit') then
      raise exception 'A reversal must use a reversal kind';
    end if;

    if v_amount <> v_original.amount then
      raise exception 'Reversal amount must equal original transaction amount';
    end if;

    if v_direction = v_original.direction then
      raise exception 'Reversal direction must be opposite to original transaction';
    end if;
  elsif p_kind in ('reversal_credit', 'reversal_debit') then
    raise exception 'reversal_of is required for reversal transactions';
  end if;

  if v_direction = 'credit' then
    v_new_balance := v_account.balance + v_amount;
  else
    if v_account.balance < v_amount then
      raise exception 'Insufficient wallet balance';
    end if;
    v_new_balance := v_account.balance - v_amount;
  end if;

  if p_operator_user_id is not null then
    select full_name
    into v_operator_name
    from public.users
    where id = p_operator_user_id;
  end if;

  perform set_config('app.wallet_mutation', 'allowed', true);

  update public.wallet_accounts
  set balance = v_new_balance
  where id = v_account.id;

  insert into public.wallet_transactions (
    wallet_account_id,
    client_id,
    direction,
    kind,
    amount,
    balance_after,
    source,
    operator_user_id,
    operator_name,
    shift_id,
    invoice_id,
    topup_intent_id,
    external_reference,
    idempotency_key,
    reversal_of,
    notes,
    metadata
  )
  values (
    v_account.id,
    p_client_id,
    v_direction,
    p_kind,
    v_amount,
    v_new_balance,
    p_source,
    p_operator_user_id,
    v_operator_name,
    p_shift_id,
    p_invoice_id,
    p_topup_intent_id,
    p_external_reference,
    p_idempotency_key,
    p_reversal_of,
    nullif(btrim(p_notes), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_result;

  return v_result;
end;
$$;

-- Safe reversal wrapper. It preserves the original row and posts the exact
-- opposite movement once.
create or replace function public.wallet_reverse_transaction(
  p_transaction_id uuid,
  p_idempotency_key text,
  p_operator_user_id text default null,
  p_shift_id text default null,
  p_notes text default null
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original public.wallet_transactions%rowtype;
  v_reverse_kind text;
begin
  select *
  into v_original
  from public.wallet_transactions
  where id = p_transaction_id;

  if not found then
    raise exception 'Original wallet transaction not found';
  end if;

  v_reverse_kind := case
    when v_original.direction = 'credit' then 'reversal_debit'
    else 'reversal_credit'
  end;

  return public.wallet_post_transaction(
    p_client_id => v_original.client_id,
    p_kind => v_reverse_kind,
    p_amount => v_original.amount,
    p_source => 'system',
    p_idempotency_key => p_idempotency_key,
    p_operator_user_id => p_operator_user_id,
    p_shift_id => p_shift_id,
    p_invoice_id => v_original.invoice_id,
    p_topup_intent_id => v_original.topup_intent_id,
    p_external_reference => null,
    p_reversal_of => v_original.id,
    p_notes => p_notes,
    p_metadata => jsonb_build_object('original_transaction_id', v_original.id)
  );
end;
$$;

-- Read models used by the future admin and client modules.
create or replace view public.wallet_account_summary as
select
  wa.id as wallet_account_id,
  wa.client_id,
  c.name as client_name,
  c.rut as client_document,
  wa.balance,
  wa.currency,
  wa.status,
  wa.savings_goal_name,
  wa.savings_goal_amount,
  wa.created_at,
  wa.updated_at
from public.wallet_accounts wa
join public.clients c on c.id = wa.client_id;

create or replace view public.wallet_shift_summary as
select
  wt.shift_id,
  wt.operator_user_id,
  wt.operator_name,
  wt.source,
  wt.direction,
  wt.kind,
  count(*) as movement_count,
  sum(wt.amount) as total_amount
from public.wallet_transactions wt
where wt.shift_id is not null
group by
  wt.shift_id,
  wt.operator_user_id,
  wt.operator_name,
  wt.source,
  wt.direction,
  wt.kind;

-- Private-by-default access. The browser must never write money directly.
alter table public.wallet_accounts enable row level security;
alter table public.nfc_cards enable row level security;
alter table public.wallet_topup_intents enable row level security;
alter table public.wallet_transactions enable row level security;

revoke all on public.wallet_accounts from anon, authenticated;
revoke all on public.nfc_cards from anon, authenticated;
revoke all on public.wallet_topup_intents from anon, authenticated;
revoke all on public.wallet_transactions from anon, authenticated;
revoke all on public.wallet_account_summary from anon, authenticated;
revoke all on public.wallet_shift_summary from anon, authenticated;

revoke all on function public.wallet_post_transaction(
  text, text, numeric, text, text, text, text, text, uuid, text, uuid, text, jsonb
) from public, anon, authenticated;

revoke all on function public.wallet_reverse_transaction(
  uuid, text, text, text, text
) from public, anon, authenticated;

grant all on public.wallet_accounts to service_role;
grant all on public.nfc_cards to service_role;
grant all on public.wallet_topup_intents to service_role;
grant all on public.wallet_transactions to service_role;
grant select on public.wallet_account_summary to service_role;
grant select on public.wallet_shift_summary to service_role;

grant execute on function public.wallet_post_transaction(
  text, text, numeric, text, text, text, text, text, uuid, text, uuid, text, jsonb
) to service_role;

grant execute on function public.wallet_reverse_transaction(
  uuid, text, text, text, text
) to service_role;

comment on table public.wallet_accounts is
  'Closed-loop customer wallet. Cached balance is changed only by wallet_post_transaction.';

comment on table public.wallet_transactions is
  'Immutable wallet ledger. Corrections must be linked reversal transactions.';

comment on table public.nfc_cards is
  'NFC mapping containing only opaque identifiers; never store client PII or balance on the card.';

comment on table public.wallet_topup_intents is
  'Payment attempts. Only an approved, verified provider webhook may post wallet funds.';
