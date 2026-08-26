-- Direct Bold checkout for eligible client-portal invoices.
-- This flow never credits or debits the client's wallet.

create or replace function public.web_bold_create_payment_intent(
  p_client_id text,
  p_invoice_id text,
  p_invoice_number text,
  p_items jsonb,
  p_delivery_fee numeric,
  p_delivery_method text,
  p_delivery_address text,
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
  v_client public.clients%rowtype;
  v_invoice public.invoices%rowtype;
  v_product public.products%rowtype;
  v_intent public.web_bold_payment_intents%rowtype;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_product_id text;
  v_quantity numeric(12,3);
  v_subtotal numeric(14,2) := 0;
  v_discount_base numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_discount_pct numeric(5,2) := 0;
  v_delivery_fee numeric(14,2);
  v_total numeric(14,2);
  v_specific_discounts jsonb := '[]'::jsonb;
begin
  if p_client_id is null or btrim(p_client_id) = '' then
    raise exception 'client_id is required';
  end if;
  if p_invoice_id is null or btrim(p_invoice_id) = ''
     or length(btrim(p_invoice_id)) > 120 then
    raise exception 'invoice_id is invalid';
  end if;
  if p_invoice_number is null or btrim(p_invoice_number) = ''
     or length(btrim(p_invoice_number)) > 120 then
    raise exception 'invoice_number is invalid';
  end if;
  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) not between 16 and 160 then
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
  if coalesce(p_delivery_method, '') not in ('oficina', 'cliente', 'recoge') then
    raise exception 'Unsupported delivery method';
  end if;

  v_delivery_fee := round(coalesce(p_delivery_fee, 0), 2);
  if v_delivery_fee < 0 or v_delivery_fee > 500000 then
    raise exception 'delivery_fee is outside the allowed range';
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
    raise exception 'Valid client session required';
  end if;

  select * into v_client
  from public.clients
  where id = p_client_id;
  if not found then
    raise exception 'Client not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('web-bold:' || btrim(p_idempotency_key), 0)
  );

  select * into v_intent
  from public.web_bold_payment_intents
  where idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_intent.client_id <> p_client_id
       or v_intent.invoice_id <> btrim(p_invoice_id) then
      raise exception 'Idempotency key was already used with different data';
    end if;

    select * into v_invoice
    from public.invoices
    where id = v_intent.invoice_id;

    return jsonb_build_object(
      'invoice', to_jsonb(v_invoice),
      'intent', to_jsonb(v_intent),
      'idempotent_replay', true
    );
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 100 then
    raise exception 'items must contain between 1 and 100 products';
  end if;

  v_discount_pct := greatest(
    0,
    least(100, coalesce(v_client.special_discount_percentage, 0))
  );
  if jsonb_typeof(v_client.discounted_product_ids) = 'array' then
    v_specific_discounts := v_client.discounted_product_ids;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Invalid product item';
    end if;

    v_product_id := coalesce(
      nullif(btrim(v_item->>'productId'), ''),
      nullif(btrim(v_item->>'product_id'), '')
    );
    if v_product_id is null or length(v_product_id) > 120 then
      raise exception 'Invalid product item';
    end if;
    if coalesce(v_item->>'quantity', '') !~ '^[0-9]+([.][0-9]{1,3})?$' then
      raise exception 'Invalid product quantity';
    end if;

    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity <= 0 or v_quantity > 100000 then
      raise exception 'Invalid product quantity';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id;
    if not found then
      raise exception 'Product not found';
    end if;

    -- Direct online payments remain limited to products explicitly reviewed
    -- and enabled by the trusted server workflow.
    if not coalesce(v_product.wallet_eligible, false)
       or coalesce(v_product.wallet_eligibility_status, '') <> 'eligible' then
      raise exception 'ONLINE_PRODUCT_NOT_ELIGIBLE';
    end if;
    if coalesce(v_product.stock, 0) < v_quantity then
      raise exception 'Insufficient product stock';
    end if;

    v_subtotal := v_subtotal + round(v_product.price * v_quantity, 2);
    if jsonb_array_length(v_specific_discounts) = 0
       or v_specific_discounts @> jsonb_build_array(v_product.id) then
      v_discount_base := v_discount_base + round(v_product.price * v_quantity, 2);
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'productName', v_product.name,
      'price', v_product.price,
      'quantity', v_quantity,
      'taxAmount', 0,
      'total', round(v_product.price * v_quantity, 2),
      'unitType', v_product.unit_type,
      'note', left(coalesce(v_item->>'note', ''), 500)
    ));
  end loop;

  v_discount := round(v_discount_base * v_discount_pct / 100, 2);
  v_total := greatest(0, round(v_subtotal - v_discount + v_delivery_fee, 2));

  if v_total < 1000 or v_total > 50000000 or v_total <> trunc(v_total) then
    raise exception 'Invoice total is outside the Bold range';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('web-bold-invoice:' || btrim(p_invoice_id), 0)
  );

  select * into v_invoice
  from public.invoices
  where id = btrim(p_invoice_id)
  for update;

  if found then
    if v_invoice.client_id is distinct from p_client_id then
      raise exception 'FORBIDDEN';
    end if;
    if round(v_invoice.total, 2) <> v_total then
      raise exception 'Existing invoice total does not match server total';
    end if;
    if lower(btrim(coalesce(v_invoice.payment_status, ''))) in
       ('pagado', 'anulada', 'vencido') then
      raise exception 'INVOICE_NOT_PAYABLE';
    end if;
  else
    insert into public.invoices (
      id, invoice_number, client_id, client_name, client_rut, items,
      subtotal, discount, tax_rate, tax_amount, total,
      payment_method, payment_status, due_date, cashier_name,
      is_delivery, delivery_fee, delivery_status, delivery_address,
      delivery_method, notes, created_at, wallet_paid_amount
    ) values (
      btrim(p_invoice_id), btrim(p_invoice_number), p_client_id,
      v_client.name, v_client.rut, v_items,
      v_subtotal, v_discount, 0, 0, v_total,
      'Bold', 'Pendiente', current_date, 'Portal Online',
      p_delivery_method <> 'recoge', v_delivery_fee, 'Pendiente',
      case
        when p_delivery_method = 'recoge' then null
        else nullif(btrim(p_delivery_address), '')
      end,
      p_delivery_method,
      'Factura pendiente de confirmacion firmada de Bold.',
      now(), 0
    )
    returning * into v_invoice;
  end if;

  insert into public.web_bold_payment_intents (
    client_id, invoice_id, created_by_session_id, order_reference,
    idempotency_key, amount, currency, status, expires_at, metadata
  ) values (
    p_client_id, v_invoice.id, p_session_id, p_order_reference,
    btrim(p_idempotency_key), v_total, 'COP', 'pending', p_expires_at,
    jsonb_build_object(
      'api_version', 1,
      'channel', 'client_portal',
      'invoice_number', v_invoice.invoice_number
    )
  )
  returning * into v_intent;

  return jsonb_build_object(
    'invoice', to_jsonb(v_invoice),
    'intent', to_jsonb(v_intent),
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.web_bold_create_payment_intent(
  text, text, text, jsonb, numeric, text, text,
  text, text, uuid, timestamptz
) from public, anon, authenticated;

grant execute on function public.web_bold_create_payment_intent(
  text, text, text, jsonb, numeric, text, text,
  text, text, uuid, timestamptz
) to service_role;

comment on function public.web_bold_create_payment_intent(
  text, text, text, jsonb, numeric, text, text,
  text, text, uuid, timestamptz
) is
  'Creates a server-priced pending invoice and direct Bold intent without modifying wallet balances.';
