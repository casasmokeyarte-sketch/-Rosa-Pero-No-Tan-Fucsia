-- Server-side creation of Bold wallet top-up intents.
-- The browser never receives the Bold integrity secret and cannot create
-- intents directly in the database.

alter table public.wallet_topup_intents
  add column if not exists created_by_session_id uuid
    references public.wallet_auth_sessions(id) on delete set null;

create index if not exists idx_wallet_topup_intents_session_created
  on public.wallet_topup_intents(created_by_session_id, created_at desc)
  where created_by_session_id is not null;

create or replace function public.wallet_create_bold_topup_intent(
  p_client_id text,
  p_amount numeric,
  p_idempotency_key text,
  p_order_reference text,
  p_session_id uuid,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_amount numeric(14,2);
  v_intent public.wallet_topup_intents%rowtype;
  v_account public.wallet_accounts%rowtype;
begin
  if p_client_id is null or btrim(p_client_id) = '' then
    raise exception 'client_id is required';
  end if;

  v_amount := round(p_amount, 2);
  if v_amount is null or v_amount < 1000 or v_amount > 50000000
     or v_amount <> trunc(v_amount) then
    raise exception 'amount must be a whole number between 1000 and 50000000 COP';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = ''
     or length(btrim(p_idempotency_key)) > 160 then
    raise exception 'idempotency_key is invalid';
  end if;

  if p_order_reference is null
     or p_order_reference !~ '^[A-Za-z0-9_-]{1,60}$' then
    raise exception 'order_reference is invalid';
  end if;

  if p_expires_at is null or p_expires_at <= now()
     or p_expires_at > now() + interval '24 hours 5 minutes' then
    raise exception 'expires_at is invalid';
  end if;

  if not exists (
    select 1
    from public.wallet_auth_sessions s
    where s.id = p_session_id
      and s.actor_type = 'client'
      and s.client_id = p_client_id
      and s.revoked_at is null
      and s.expires_at > now()
  ) then
    raise exception 'Valid client wallet session required';
  end if;

  select * into v_account
  from public.wallet_accounts
  where client_id = p_client_id
  for update;

  if not found then
    raise exception 'Wallet account not found';
  end if;
  if v_account.status <> 'active' then
    raise exception 'Wallet account is not active';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(btrim(p_idempotency_key), 0));

  select * into v_intent
  from public.wallet_topup_intents
  where idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_intent.client_id <> p_client_id or v_intent.amount <> v_amount then
      raise exception 'Idempotency key was already used with different data';
    end if;
  else
    insert into public.wallet_topup_intents (
      client_id,
      amount,
      currency,
      provider,
      status,
      order_reference,
      idempotency_key,
      provider_payload,
      expires_at,
      created_by_session_id
    ) values (
      p_client_id,
      v_amount,
      'COP',
      'bold',
      'pending',
      p_order_reference,
      btrim(p_idempotency_key),
      jsonb_build_object('api_version', 3, 'created_by', 'wallet-api'),
      p_expires_at,
      p_session_id
    )
    returning * into v_intent;
  end if;

  return jsonb_build_object(
    'id', v_intent.id,
    'client_id', v_intent.client_id,
    'amount', v_intent.amount,
    'currency', v_intent.currency,
    'status', v_intent.status,
    'order_reference', v_intent.order_reference,
    'expires_at', v_intent.expires_at,
    'created_at', v_intent.created_at
  );
end;
$$;

revoke all on function public.wallet_create_bold_topup_intent(
  text, numeric, text, text, uuid, timestamptz
) from public, anon, authenticated;

grant execute on function public.wallet_create_bold_topup_intent(
  text, numeric, text, text, uuid, timestamptz
) to service_role;

comment on function public.wallet_create_bold_topup_intent(
  text, numeric, text, text, uuid, timestamptz
) is 'Creates an authenticated and idempotent Bold wallet top-up intent without changing wallet balance.';
