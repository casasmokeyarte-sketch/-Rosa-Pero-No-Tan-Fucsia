-- ============================================================
-- Bold wallet webhook: verified, idempotent settlement
-- ============================================================

alter table public.wallet_topup_intents
  drop constraint if exists wallet_topup_intents_status_check;

alter table public.wallet_topup_intents
  add constraint wallet_topup_intents_status_check
  check (status in (
    'pending', 'approved', 'rejected', 'expired', 'cancelled',
    'voided', 'review_required'
  ));

create table if not exists public.wallet_webhook_events (
  notification_id text primary key,
  provider text not null default 'bold' check (provider = 'bold'),
  event_type text not null check (event_type in (
    'SALE_APPROVED', 'SALE_REJECTED', 'VOID_APPROVED', 'VOID_REJECTED'
  )),
  payment_id text not null,
  merchant_id text not null,
  order_reference text,
  amount numeric(14,2),
  currency text,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  processing_status text not null default 'received' check (processing_status in (
    'received', 'processed', 'ignored', 'review_required'
  )),
  topup_intent_id uuid references public.wallet_topup_intents(id) on delete set null,
  wallet_transaction_id uuid references public.wallet_transactions(id) on delete set null,
  event_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create index if not exists idx_wallet_webhook_events_payment
  on public.wallet_webhook_events(payment_id, received_at desc);

create index if not exists idx_wallet_webhook_events_reference
  on public.wallet_webhook_events(order_reference, received_at desc)
  where order_reference is not null;

create or replace function public.wallet_process_bold_event(
  p_notification_id text,
  p_event_type text,
  p_payment_id text,
  p_merchant_id text,
  p_order_reference text,
  p_amount numeric,
  p_currency text,
  p_payload_sha256 text,
  p_event_created_at timestamptz default null,
  p_provider_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.wallet_webhook_events%rowtype;
  v_intent public.wallet_topup_intents%rowtype;
  v_transaction public.wallet_transactions%rowtype;
  v_reversal public.wallet_transactions%rowtype;
  v_error text;
begin
  if p_notification_id is null or btrim(p_notification_id) = '' then
    raise exception 'notification_id is required';
  end if;

  if p_event_type not in (
    'SALE_APPROVED', 'SALE_REJECTED', 'VOID_APPROVED', 'VOID_REJECTED'
  ) then
    raise exception 'Unsupported Bold event type';
  end if;

  if p_payment_id is null or btrim(p_payment_id) = '' then
    raise exception 'payment_id is required';
  end if;

  if p_merchant_id is null or btrim(p_merchant_id) = '' then
    raise exception 'merchant_id is required';
  end if;

  if p_payload_sha256 is null or p_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Valid payload_sha256 is required';
  end if;

  insert into public.wallet_webhook_events (
    notification_id, event_type, payment_id, merchant_id, order_reference,
    amount, currency, payload_sha256, event_created_at
  )
  values (
    p_notification_id, p_event_type, p_payment_id, p_merchant_id,
    nullif(btrim(p_order_reference), ''), round(p_amount, 2),
    upper(btrim(p_currency)), p_payload_sha256, p_event_created_at
  )
  on conflict (notification_id) do nothing
  returning * into v_event;

  if not found then
    select * into v_event
    from public.wallet_webhook_events
    where notification_id = p_notification_id;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'processing_status', v_event.processing_status,
      'wallet_transaction_id', v_event.wallet_transaction_id
    );
  end if;

  if p_order_reference is null or btrim(p_order_reference) = '' then
    update public.wallet_webhook_events
    set processing_status = 'ignored', processed_at = now(),
        error_message = 'Missing wallet order reference'
    where notification_id = p_notification_id;
    return jsonb_build_object('ok', true, 'matched', false, 'reason', 'missing_reference');
  end if;

  select * into v_intent
  from public.wallet_topup_intents
  where order_reference = btrim(p_order_reference) and provider = 'bold'
  for update;

  if not found then
    update public.wallet_webhook_events
    set processing_status = 'ignored', processed_at = now(),
        error_message = 'No wallet top-up intent matches this reference'
    where notification_id = p_notification_id;
    return jsonb_build_object('ok', true, 'matched', false, 'reason', 'unknown_reference');
  end if;

  update public.wallet_webhook_events
  set topup_intent_id = v_intent.id
  where notification_id = p_notification_id;

  if p_event_type in ('SALE_APPROVED', 'VOID_APPROVED') and (
    p_amount is null or round(p_amount, 2) <> v_intent.amount
    or upper(btrim(coalesce(p_currency, ''))) <> v_intent.currency
  ) then
    update public.wallet_topup_intents
    set status = 'review_required',
        provider_payload = jsonb_build_object(
          'event_type', p_event_type,
          'payment_id', p_payment_id,
          'merchant_id', p_merchant_id,
          'amount', p_amount,
          'currency', p_currency,
          'payload_sha256', p_payload_sha256
        ) || coalesce(p_provider_summary, '{}'::jsonb)
    where id = v_intent.id;

    update public.wallet_webhook_events
    set processing_status = 'review_required', processed_at = now(),
        error_message = 'Bold amount or currency does not match the wallet intent'
    where notification_id = p_notification_id;
    return jsonb_build_object('ok', true, 'matched', true, 'review_required', true);
  end if;

  if p_event_type = 'SALE_REJECTED' then
    if v_intent.status = 'pending' then
      update public.wallet_topup_intents
      set status = 'rejected',
          provider_transaction_id = coalesce(provider_transaction_id, p_payment_id),
          provider_payload = jsonb_build_object(
            'event_type', p_event_type,
            'payment_id', p_payment_id,
            'merchant_id', p_merchant_id,
            'payload_sha256', p_payload_sha256
          ) || coalesce(p_provider_summary, '{}'::jsonb)
      where id = v_intent.id;
    end if;

    update public.wallet_webhook_events
    set processing_status = 'processed', processed_at = now()
    where notification_id = p_notification_id;
    return jsonb_build_object('ok', true, 'matched', true, 'credited', false);
  end if;

  if p_event_type = 'VOID_REJECTED' then
    update public.wallet_webhook_events
    set processing_status = 'ignored', processed_at = now()
    where notification_id = p_notification_id;
    return jsonb_build_object('ok', true, 'matched', true, 'credited', false);
  end if;

  if p_event_type = 'SALE_APPROVED' then
    if exists (
      select 1 from public.wallet_topup_intents
      where provider_transaction_id = p_payment_id and id <> v_intent.id
    ) then
      update public.wallet_topup_intents set status = 'review_required'
      where id = v_intent.id;
      update public.wallet_webhook_events
      set processing_status = 'review_required', processed_at = now(),
          error_message = 'Bold payment_id is already assigned to another intent'
      where notification_id = p_notification_id;
      return jsonb_build_object('ok', true, 'matched', true, 'review_required', true);
    end if;

    select * into v_transaction
    from public.wallet_transactions
    where topup_intent_id = v_intent.id and kind = 'topup_bold'
    order by created_at asc limit 1;

    if not found then
      select * into v_transaction
      from public.wallet_post_transaction(
        p_client_id => v_intent.client_id,
        p_kind => 'topup_bold',
        p_amount => v_intent.amount,
        p_source => 'bold',
        p_idempotency_key => 'bold-sale:' || p_payment_id,
        p_topup_intent_id => v_intent.id,
        p_external_reference => p_payment_id,
        p_notes => 'Recarga de Bolsillo aprobada por webhook Bold',
        p_metadata => jsonb_build_object(
          'provider', 'bold',
          'merchant_id', p_merchant_id,
          'notification_id', p_notification_id,
          'payload_sha256', p_payload_sha256
        ) || coalesce(p_provider_summary, '{}'::jsonb)
      );
    end if;

    update public.wallet_topup_intents
    set status = 'approved', provider_transaction_id = p_payment_id,
        approved_at = coalesce(approved_at, now()),
        provider_payload = jsonb_build_object(
          'event_type', p_event_type,
          'payment_id', p_payment_id,
          'merchant_id', p_merchant_id,
          'payload_sha256', p_payload_sha256
        ) || coalesce(p_provider_summary, '{}'::jsonb)
    where id = v_intent.id;

    update public.wallet_webhook_events
    set processing_status = 'processed', wallet_transaction_id = v_transaction.id,
        processed_at = now()
    where notification_id = p_notification_id;

    return jsonb_build_object(
      'ok', true, 'matched', true, 'credited', true,
      'wallet_transaction_id', v_transaction.id
    );
  end if;

  select * into v_transaction
  from public.wallet_transactions
  where topup_intent_id = v_intent.id and kind = 'topup_bold'
  order by created_at asc limit 1;

  if not found then
    update public.wallet_topup_intents set status = 'review_required'
    where id = v_intent.id;
    update public.wallet_webhook_events
    set processing_status = 'review_required', processed_at = now(),
        error_message = 'Approved wallet credit was not found for this void'
    where notification_id = p_notification_id;
    return jsonb_build_object('ok', true, 'matched', true, 'review_required', true);
  end if;

  select * into v_reversal
  from public.wallet_transactions where reversal_of = v_transaction.id limit 1;

  if not found then
    begin
      select * into v_reversal
      from public.wallet_reverse_transaction(
        p_transaction_id => v_transaction.id,
        p_idempotency_key => 'bold-void:' || p_payment_id,
        p_notes => 'Anulación de recarga confirmada por webhook Bold'
      );
    exception when others then
      v_error := sqlerrm;
      update public.wallet_accounts set status = 'blocked'
      where client_id = v_intent.client_id;
      update public.wallet_topup_intents set status = 'review_required'
      where id = v_intent.id;
      update public.wallet_webhook_events
      set processing_status = 'review_required', processed_at = now(),
          error_message = left('Automatic void reversal failed: ' || v_error, 500)
      where notification_id = p_notification_id;
      return jsonb_build_object(
        'ok', true, 'matched', true, 'review_required', true, 'wallet_blocked', true
      );
    end;
  end if;

  update public.wallet_topup_intents set status = 'voided'
  where id = v_intent.id;
  update public.wallet_webhook_events
  set processing_status = 'processed', wallet_transaction_id = v_reversal.id,
      processed_at = now()
  where notification_id = p_notification_id;

  return jsonb_build_object(
    'ok', true, 'matched', true, 'voided', true,
    'wallet_transaction_id', v_reversal.id
  );
end;
$$;

alter table public.wallet_webhook_events enable row level security;

revoke all on public.wallet_webhook_events from anon, authenticated;
revoke all on function public.wallet_process_bold_event(
  text, text, text, text, text, numeric, text, text, timestamptz, jsonb
) from public, anon, authenticated;

grant all on public.wallet_webhook_events to service_role;
grant execute on function public.wallet_process_bold_event(
  text, text, text, text, text, numeric, text, text, timestamptz, jsonb
) to service_role;

comment on table public.wallet_webhook_events is
  'Minimal private audit log for verified Bold webhook notifications; raw payer data is not stored.';

comment on function public.wallet_process_bold_event(
  text, text, text, text, text, numeric, text, text, timestamptz, jsonb
) is
  'Atomically settles verified Bold wallet events and prevents duplicate credits.';
