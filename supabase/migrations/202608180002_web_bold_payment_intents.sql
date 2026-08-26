-- Private Bold payment intents for eligible web orders.
-- Creating an intent never marks an invoice as paid.

create table if not exists public.web_bold_payment_intents (
  id uuid primary key default gen_random_uuid(),
  client_id text not null
    references public.clients(id) on delete restrict,
  invoice_id text not null unique
    references public.invoices(id) on delete restrict,
  created_by_session_id uuid
    references public.wallet_auth_sessions(id) on delete set null,
  provider text not null default 'bold'
    check (provider = 'bold'),
  order_reference text not null unique
    check (order_reference ~ '^[A-Za-z0-9_-]{1,60}$'),
  idempotency_key text not null unique
    check (
      length(btrim(idempotency_key)) between 16 and 160
    ),
  amount numeric(14,2) not null
    check (
      amount >= 1000
      and amount <= 50000000
      and amount = trunc(amount)
    ),
  currency text not null default 'COP'
    check (currency = 'COP'),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'rejected',
        'cancelled',
        'expired',
        'review_required'
      )
    ),
  provider_payment_id text unique,
  expires_at timestamptz not null,
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  last_event_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_bold_payment_intents_expiry_check
    check (expires_at > created_at)
);

create index if not exists idx_web_bold_intents_client_created
  on public.web_bold_payment_intents(client_id, created_at desc);

create index if not exists idx_web_bold_intents_status_expires
  on public.web_bold_payment_intents(status, expires_at);

create or replace function public.touch_web_bold_payment_intent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_web_bold_payment_intents_updated_at
  on public.web_bold_payment_intents;

create trigger trg_web_bold_payment_intents_updated_at
before update on public.web_bold_payment_intents
for each row
execute function public.touch_web_bold_payment_intent();

alter table public.web_bold_payment_intents enable row level security;

revoke all on public.web_bold_payment_intents
  from public, anon, authenticated;

grant all on public.web_bold_payment_intents
  to service_role;

comment on table public.web_bold_payment_intents is
  'Private server-created Bold intents for eligible web invoices; browser redirects never approve payment.';
