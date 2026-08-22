-- Verified and idempotent Bold settlement for direct web invoices.
-- This flow never credits or debits the client wallet.

alter table public.wallet_webhook_events
  add column if not exists web_payment_intent_id uuid
    references public.web_bold_payment_intents(id)
    on delete set null;

create index if not exists idx_wallet_webhook_events_web_intent
  on public.wallet_webhook_events(web_payment_intent_id)
  where web_payment_intent_id is not null;

create or replace function public.web_bold_process_event(
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
  v_intent public.web_bold_payment_intents%rowtype;
  v_invoice public.invoices%rowtype;
  v_event_time timestamptz;
  v_provider_metadata jsonb;
begin
  if p_notification_id is null
     or btrim(p_notification_id) = '' then
    raise exception 'notification_id is required';
  end if;

  if p_event_type not in (
    'SALE_APPROVED',
    'SALE_REJECTED',
    'VOID_APPROVED',
    'VOID_REJECTED'
  ) then
    raise exception 'Unsupported Bold event type';
  end if;

  if p_payment_id is null
     or btrim(p_payment_id) = '' then
    raise exception 'payment_id is required';
  end if;

  if p_merchant_id is null
     or btrim(p_merchant_id) = '' then
    raise exception 'merchant_id is required';
  end if;

  if p_order_reference is null
     or btrim(p_order_reference) = ''
     or btrim(p_order_reference) !~ '^WEB-[A-Za-z0-9_-]+$' then
    raise exception 'Valid web order reference is required';
  end if;

  if p_payload_sha256 is null
     or p_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Valid payload_sha256 is required';
  end if;

  v_event_time := coalesce(p_event_created_at, now());

  v_provider_metadata :=
    jsonb_build_object(
      'last_event_type', p_event_type,
      'last_payment_id', btrim(p_payment_id),
      'merchant_id', btrim(p_merchant_id),
      'payload_sha256', p_payload_sha256,
      'last_event_at', v_event_time
    )
    || coalesce(p_provider_summary, '{}'::jsonb);

  insert into public.wallet_webhook_events (
    notification_id,
    event_type,
    payment_id,
    merchant_id,
    order_reference,
    amount,
    currency,
    payload_sha256,
    event_created_at
  )
  values (
    btrim(p_notification_id),
    p_event_type,
    btrim(p_payment_id),
    btrim(p_merchant_id),
    btrim(p_order_reference),
    round(p_amount, 2),
    upper(btrim(p_currency)),
    p_payload_sha256,
    p_event_created_at
  )
  on conflict (notification_id) do nothing
  returning * into v_event;

  if not found then
    select *
    into v_event
    from public.wallet_webhook_events
    where notification_id = btrim(p_notification_id);

    return jsonb_build_object(
      'ok', true,
      'matched', v_event.web_payment_intent_id is not null,
      'duplicate', true,
      'processing_status', v_event.processing_status,
      'web_payment_intent_id', v_event.web_payment_intent_id
    );
  end if;

  select *
  into v_intent
  from public.web_bold_payment_intents
  where order_reference = btrim(p_order_reference)
    and provider = 'bold'
  for update;

  if not found then
    update public.wallet_webhook_events
    set
      processing_status = 'ignored',
      processed_at = now(),
      error_message =
        'No direct Bold payment intent matches this reference'
    where notification_id = btrim(p_notification_id);

    return jsonb_build_object(
      'ok', true,
      'matched', false,
      'reason', 'unknown_reference'
    );
  end if;

  update public.wallet_webhook_events
  set web_payment_intent_id = v_intent.id
  where notification_id = btrim(p_notification_id);

  if p_amount is null
     or round(p_amount, 2) <> v_intent.amount
     or upper(btrim(coalesce(p_currency, '')))
          <> v_intent.currency then

    update public.web_bold_payment_intents
    set
      status = 'review_required',
      last_event_at = v_event_time,
      error_message =
        'Bold amount or currency does not match the direct invoice intent',
      metadata = coalesce(metadata, '{}'::jsonb)
        || v_provider_metadata
    where id = v_intent.id;

    update public.wallet_webhook_events
    set
      processing_status = 'review_required',
      processed_at = now(),
      error_message =
        'Bold amount or currency does not match the direct invoice intent'
    where notification_id = btrim(p_notification_id);

    return jsonb_build_object(
      'ok', true,
      'matched', true,
      'review_required', true
    );
  end if;

  if exists (
    select 1
    from public.web_bold_payment_intents
    where provider_payment_id = btrim(p_payment_id)
      and id <> v_intent.id
  ) then
    update public.web_bold_payment_intents
    set
      status = 'review_required',
      last_event_at = v_event_time,
      error_message =
        'Bold payment_id is already assigned to another direct intent',
      metadata = coalesce(metadata, '{}'::jsonb)
        || v_provider_metadata
    where id = v_intent.id;

    update public.wallet_webhook_events
    set
      processing_status = 'review_required',
      processed_at = now(),
      error_message =
        'Bold payment_id is already assigned to another direct intent'
    where notification_id = btrim(p_notification_id);

    return jsonb_build_object(
      'ok', true,
      'matched', true,
      'review_required', true
    );
  end if;

  if p_event_type = 'SALE_REJECTED' then
    if v_intent.status = 'pending' then
      update public.web_bold_payment_intents
      set
        status = 'rejected',
        provider_payment_id =
          coalesce(provider_payment_id, btrim(p_payment_id)),
        rejected_at = coalesce(rejected_at, v_event_time),
        last_event_at = v_event_time,
        error_message = 'Bold rejected the direct invoice payment',
        metadata = coalesce(metadata, '{}'::jsonb)
          || v_provider_metadata
      where id = v_intent.id;
    end if;

    update public.wallet_webhook_events
    set
      processing_status = 'processed',
      processed_at = now()
    where notification_id = btrim(p_notification_id);

    return jsonb_build_object(
      'ok', true,
      'matched', true,
      'paid', false,
      'rejected', true
    );
  end if;

  if p_event_type = 'VOID_REJECTED' then
    update public.web_bold_payment_intents
    set
      last_event_at = v_event_time,
      metadata = coalesce(metadata, '{}'::jsonb)
        || v_provider_metadata
    where id = v_intent.id;

    update public.wallet_webhook_events
    set
      processing_status = 'ignored',
      processed_at = now()
    where notification_id = btrim(p_notification_id);

    return jsonb_build_object(
      'ok', true,
      'matched', true,
      'paid', v_intent.status = 'approved',
      'void_rejected', true
    );
  end if;

  select *
  into v_invoice
  from public.invoices
  where id = v_intent.invoice_id
  for update;

  if not found
     or v_invoice.client_id is distinct from v_intent.client_id
     or round(v_invoice.total, 2) <> v_intent.amount then

    update public.web_bold_payment_intents
    set
      status = 'review_required',
      last_event_at = v_event_time,
      error_message =
        'Invoice does not match the direct Bold payment intent',
      metadata = coalesce(metadata, '{}'::jsonb)
        || v_provider_metadata
    where id = v_intent.id;

    update public.wallet_webhook_events
    set
      processing_status = 'review_required',
      processed_at = now(),
      error_message =
        'Invoice does not match the direct Bold payment intent'
    where notification_id = btrim(p_notification_id);

    return jsonb_build_object(
      'ok', true,
      'matched', true,
      'review_required', true
    );
  end if;

  if p_event_type = 'SALE_APPROVED' then
    if lower(btrim(coalesce(v_invoice.payment_status, '')))
       in ('anulada', 'vencido') then

      update public.web_bold_payment_intents
      set
        status = 'review_required',
        last_event_at = v_event_time,
        error_message =
          'Invoice is not payable in its current state',
        metadata = coalesce(metadata, '{}'::jsonb)
          || v_provider_metadata
      where id = v_intent.id;

      update public.wallet_webhook_events
      set
        processing_status = 'review_required',
        processed_at = now(),
        error_message =
          'Invoice is not payable in its current state'
      where notification_id = btrim(p_notification_id);

      return jsonb_build_object(
        'ok', true,
        'matched', true,
        'review_required', true
      );
    end if;

    if lower(btrim(coalesce(v_invoice.payment_status, '')))
         = 'pagado'
       and lower(btrim(coalesce(v_invoice.payment_method, '')))
         <> 'bold' then

      update public.web_bold_payment_intents
      set
        status = 'review_required',
        last_event_at = v_event_time,
        error_message =
          'Invoice was already paid using another payment method',
        metadata = coalesce(metadata, '{}'::jsonb)
          || v_provider_metadata
      where id = v_intent.id;

      update public.wallet_webhook_events
      set
        processing_status = 'review_required',
        processed_at = now(),
        error_message =
          'Invoice was already paid using another payment method'
      where notification_id = btrim(p_notification_id);

      return jsonb_build_object(
        'ok', true,
        'matched', true,
        'review_required', true
      );
    end if;

    update public.invoices
    set
      payment_status = 'Pagado',
      payment_method = 'Bold'
    where id = v_invoice.id;

    update public.web_bold_payment_intents
    set
      status = 'approved',
      provider_payment_id =
        coalesce(provider_payment_id, btrim(p_payment_id)),
      approved_at = coalesce(approved_at, v_event_time),
      last_event_at = v_event_time,
      error_message = null,
      metadata = coalesce(metadata, '{}'::jsonb)
        || v_provider_metadata
    where id = v_intent.id;

    update public.wallet_webhook_events
    set
      processing_status = 'processed',
      processed_at = now()
    where notification_id = btrim(p_notification_id);

    return jsonb_build_object(
      'ok', true,
      'matched', true,
      'paid', true,
      'invoice_id', v_invoice.id,
      'web_payment_intent_id', v_intent.id
    );
  end if;

  -- VOID_APPROVED never changes an invoice automatically.
  -- A verified administrator must reconcile the refund first.
  update public.web_bold_payment_intents
  set
    status = 'review_required',
    last_event_at = v_event_time,
    error_message =
      'Bold approved a void; manual invoice reconciliation is required',
    metadata = coalesce(metadata, '{}'::jsonb)
      || v_provider_metadata
  where id = v_intent.id;

  update public.wallet_webhook_events
  set
    processing_status = 'review_required',
    processed_at = now(),
    error_message =
      'Bold approved a void; manual invoice reconciliation is required'
  where notification_id = btrim(p_notification_id);

  return jsonb_build_object(
    'ok', true,
    'matched', true,
    'paid', v_intent.status = 'approved',
    'void_approved', true,
    'review_required', true,
    'invoice_id', v_invoice.id
  );
end;
$$;

revoke all on function public.web_bold_process_event(
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;

grant execute on function public.web_bold_process_event(
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  timestamptz,
  jsonb
) to service_role;

comment on function public.web_bold_process_event(
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  timestamptz,
  jsonb
) is
  'Settles verified direct Bold invoice events without modifying wallet balances.';
