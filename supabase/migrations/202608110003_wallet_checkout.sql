-- Secure wallet checkout and conservative product eligibility.
-- Products are NOT wallet-payable until an authorized administrator classifies
-- them as eligible. This prevents wallet funds from bypassing independent
-- legal, identity, age or product restrictions.

alter table public.products
  add column if not exists wallet_eligible boolean not null default false;

alter table public.invoices
  add column if not exists wallet_paid_amount numeric(14,2) not null default 0
    check (wallet_paid_amount >= 0);

create index if not exists idx_invoices_wallet_client_status
  on public.invoices(client_id, payment_status)
  where wallet_paid_amount > 0;

create or replace function public.protect_wallet_product_eligibility()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.wallet_eligible is distinct from old.wallet_eligible
     and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Wallet product eligibility requires an authorized server operation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_protect_wallet_eligibility on public.products;
create trigger trg_products_protect_wallet_eligibility
before update of wallet_eligible on public.products
for each row execute function public.protect_wallet_product_eligibility();

create or replace function public.wallet_purchase_invoice(
  p_client_id text,
  p_invoice_id text,
  p_invoice_number text,
  p_items jsonb,
  p_delivery_fee numeric,
  p_delivery_method text,
  p_delivery_address text,
  p_wallet_amount numeric,
  p_idempotency_key text,
  p_session_id uuid
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
  v_transaction public.wallet_transactions%rowtype;
  v_existing_transaction public.wallet_transactions%rowtype;
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
  v_paid_before numeric(14,2);
  v_paid_after numeric(14,2);
  v_due_before numeric(14,2);
  v_due_after numeric(14,2);
  v_wallet_amount numeric(14,2);
  v_payment_status text;
  v_payment_method text;
  v_specific_discounts jsonb := '[]'::jsonb;
begin
  if p_client_id is null or btrim(p_client_id) = '' then
    raise exception 'client_id is required';
  end if;
  if p_invoice_id is null or btrim(p_invoice_id) = '' or length(btrim(p_invoice_id)) > 120 then
    raise exception 'invoice_id is invalid';
  end if;
  if p_invoice_number is null or btrim(p_invoice_number) = ''
     or length(btrim(p_invoice_number)) > 120 then
    raise exception 'invoice_number is invalid';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = ''
     or length(btrim(p_idempotency_key)) > 160 then
    raise exception 'idempotency_key is invalid';
  end if;

  v_wallet_amount := round(p_wallet_amount, 2);
  if v_wallet_amount is null or v_wallet_amount <= 0 or v_wallet_amount > 50000000 then
    raise exception 'wallet_amount is outside the allowed range';
  end if;

  v_delivery_fee := round(coalesce(p_delivery_fee, 0), 2);
  if v_delivery_fee < 0 or v_delivery_fee > 500000 then
    raise exception 'delivery_fee is outside the allowed range';
  end if;
  if coalesce(p_delivery_method, '') not in ('oficina', 'cliente', 'recoge') then
    raise exception 'Unsupported delivery method';
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

  select * into v_client
  from public.clients
  where id = p_client_id;

  if not found then
    raise exception 'Client not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('wallet-invoice:' || btrim(p_invoice_id), 0));

  select * into v_invoice
  from public.invoices
  where id = btrim(p_invoice_id)
  for update;

  if not found then
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

      v_product_id := nullif(btrim(v_item->>'productId'), '');
      if v_product_id is null then
        v_product_id := nullif(btrim(v_item->>'product_id'), '');
      end if;
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
      if not coalesce(v_product.wallet_eligible, false) then
        raise exception 'WALLET_PRODUCT_NOT_ELIGIBLE';
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

    if v_total <= 0 then
      raise exception 'Invoice total must be greater than zero';
    end if;

    insert into public.invoices (
      id,
      invoice_number,
      client_id,
      client_name,
      client_rut,
      items,
      subtotal,
      discount,
      tax_rate,
      tax_amount,
      total,
      payment_method,
      payment_status,
      due_date,
      cashier_name,
      is_delivery,
      delivery_fee,
      delivery_status,
      delivery_address,
      delivery_method,
      notes,
      created_at,
      wallet_paid_amount
    ) values (
      btrim(p_invoice_id),
      btrim(p_invoice_number),
      p_client_id,
      v_client.name,
      v_client.rut,
      v_items,
      v_subtotal,
      v_discount,
      0,
      0,
      v_total,
      'Bolsillo',
      'Pendiente',
      current_date + 15,
      'Portal Online',
      p_delivery_method <> 'recoge',
      v_delivery_fee,
      'Pendiente',
      case when p_delivery_method = 'recoge' then null else nullif(btrim(p_delivery_address), '') end,
      p_delivery_method,
      'Pedido creado mediante pago seguro del Bolsillo.',
      now(),
      0
    )
    returning * into v_invoice;
  else
    if v_invoice.client_id is distinct from p_client_id then
      raise exception 'FORBIDDEN';
    end if;
    if lower(btrim(coalesce(v_invoice.payment_status, ''))) in ('pagado', 'anulada', 'vencido') then
      raise exception 'INVOICE_NOT_PAYABLE';
    end if;

    for v_item in select value from jsonb_array_elements(coalesce(v_invoice.items, '[]'::jsonb))
    loop
      v_product_id := coalesce(v_item->>'productId', v_item->>'product_id');
      select * into v_product from public.products where id = v_product_id;
      if not found or not coalesce(v_product.wallet_eligible, false) then
        raise exception 'WALLET_PRODUCT_NOT_ELIGIBLE';
      end if;
    end loop;
  end if;

  select * into v_existing_transaction
  from public.wallet_transactions
  where idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_existing_transaction.client_id <> p_client_id
       or v_existing_transaction.invoice_id is distinct from v_invoice.id
       or v_existing_transaction.amount <> v_wallet_amount
       or v_existing_transaction.kind <> 'purchase' then
      raise exception 'Idempotency key was already used with different data';
    end if;

    return jsonb_build_object(
      'invoice', jsonb_build_object(
        'id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'client_id', v_invoice.client_id,
        'client_name', v_invoice.client_name,
        'client_rut', v_invoice.client_rut,
        'items', v_invoice.items,
        'subtotal', v_invoice.subtotal,
        'discount', v_invoice.discount,
        'tax_rate', v_invoice.tax_rate,
        'tax_amount', v_invoice.tax_amount,
        'total', v_invoice.total,
        'wallet_paid_amount', v_invoice.wallet_paid_amount,
        'amount_due', greatest(0, v_invoice.total - v_invoice.wallet_paid_amount),
        'payment_method', v_invoice.payment_method,
        'payment_status', v_invoice.payment_status,
        'due_date', v_invoice.due_date,
        'cashier_name', v_invoice.cashier_name,
        'is_delivery', v_invoice.is_delivery,
        'delivery_fee', v_invoice.delivery_fee,
        'delivery_status', v_invoice.delivery_status,
        'delivery_address', v_invoice.delivery_address,
        'delivery_method', v_invoice.delivery_method,
        'notes', v_invoice.notes,
        'created_at', v_invoice.created_at
      ),
      'transaction', to_jsonb(v_existing_transaction),
      'idempotent_replay', true
    );
  end if;

  v_paid_before := round(coalesce(v_invoice.wallet_paid_amount, 0), 2);
  v_due_before := greatest(0, round(v_invoice.total - v_paid_before, 2));
  if v_due_before <= 0 then
    raise exception 'INVOICE_NOT_PAYABLE';
  end if;
  if v_wallet_amount > v_due_before then
    raise exception 'wallet amount exceeds invoice balance';
  end if;

  select * into v_transaction
  from public.wallet_post_transaction(
    p_client_id => p_client_id,
    p_kind => 'purchase',
    p_amount => v_wallet_amount,
    p_source => 'wallet',
    p_idempotency_key => btrim(p_idempotency_key),
    p_invoice_id => v_invoice.id,
    p_notes => 'Pago aplicado desde el Bolsillo del cliente.',
    p_metadata => jsonb_build_object(
      'api_version', 4,
      'channel', 'client_portal',
      'invoice_number', v_invoice.invoice_number
    )
  );

  v_paid_after := round(v_paid_before + v_wallet_amount, 2);
  v_due_after := greatest(0, round(v_invoice.total - v_paid_after, 2));
  v_payment_status := case when v_due_after = 0 then 'Pagado' else 'Pendiente' end;
  v_payment_method := case when v_due_after = 0 then 'Bolsillo' else 'Bolsillo parcial' end;

  update public.invoices
  set wallet_paid_amount = v_paid_after,
      payment_status = v_payment_status,
      payment_method = v_payment_method,
      notes = concat_ws(
        E'\n',
        nullif(notes, ''),
        format(
          'Bolsillo aplicado: %s COP. Saldo pendiente: %s COP.',
          trim(to_char(v_wallet_amount, 'FM999999999990.00')),
          trim(to_char(v_due_after, 'FM999999999990.00'))
        )
      )
  where id = v_invoice.id
  returning * into v_invoice;

  return jsonb_build_object(
    'invoice', jsonb_build_object(
      'id', v_invoice.id,
      'invoice_number', v_invoice.invoice_number,
      'client_id', v_invoice.client_id,
      'client_name', v_invoice.client_name,
      'client_rut', v_invoice.client_rut,
      'items', v_invoice.items,
      'subtotal', v_invoice.subtotal,
      'discount', v_invoice.discount,
      'tax_rate', v_invoice.tax_rate,
      'tax_amount', v_invoice.tax_amount,
      'total', v_invoice.total,
      'wallet_paid_amount', v_invoice.wallet_paid_amount,
      'amount_due', v_due_after,
      'payment_method', v_invoice.payment_method,
      'payment_status', v_invoice.payment_status,
      'due_date', v_invoice.due_date,
      'cashier_name', v_invoice.cashier_name,
      'is_delivery', v_invoice.is_delivery,
      'delivery_fee', v_invoice.delivery_fee,
      'delivery_status', v_invoice.delivery_status,
      'delivery_address', v_invoice.delivery_address,
      'delivery_method', v_invoice.delivery_method,
      'notes', v_invoice.notes,
      'created_at', v_invoice.created_at
    ),
    'transaction', to_jsonb(v_transaction),
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.wallet_purchase_invoice(
  text, text, text, jsonb, numeric, text, text, numeric, text, uuid
) from public, anon, authenticated;

grant execute on function public.wallet_purchase_invoice(
  text, text, text, jsonb, numeric, text, text, numeric, text, uuid
) to service_role;

comment on column public.products.wallet_eligible is
  'Explicit server-managed eligibility for closed-loop wallet payments. False by default.';

comment on column public.invoices.wallet_paid_amount is
  'Cumulative wallet amount posted through the immutable wallet ledger.';

comment on function public.wallet_purchase_invoice(
  text, text, text, jsonb, numeric, text, text, numeric, text, uuid
) is
  'Atomically creates or pays a client invoice with wallet funds after session, ownership, product eligibility and balance checks.';
