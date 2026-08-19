-- Inventory movement quarantine.
-- Existing products remain unreviewed unless already restricted.
-- Transfers are rejected unless every included product is explicitly allowed.

alter table public.products
  add column if not exists inventory_movement_status text
  not null default 'unreviewed';

alter table public.products
  add column if not exists inventory_movement_reviewed_at timestamptz;

alter table public.products
  add column if not exists inventory_movement_reviewed_by text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_inventory_movement_status_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_inventory_movement_status_check
      check (
        inventory_movement_status in (
          'unreviewed',
          'allowed',
          'restricted'
        )
      );
  end if;
end;
$$;

-- Restricted payment products are also restricted from inventory movement.
update public.products
set
  inventory_movement_status = 'restricted',
  inventory_movement_reviewed_at = now(),
  inventory_movement_reviewed_by = 'system'
where coalesce(wallet_eligibility_status, '') = 'restricted';

create or replace function public.enforce_inventory_movement_quarantine()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_previous_status text;
  v_trusted_role boolean;
begin
  v_trusted_role :=
    current_user in ('postgres', 'service_role', 'supabase_admin');

  if tg_op = 'INSERT' then
    v_previous_status := 'unreviewed';

    -- Browser/API callers cannot choose review state or forge audit fields.
    if not v_trusted_role then
      new.inventory_movement_status := 'unreviewed';
      new.inventory_movement_reviewed_at := null;
      new.inventory_movement_reviewed_by := null;
    end if;
  else
    v_previous_status :=
      coalesce(old.inventory_movement_status, 'unreviewed');
  end if;

  -- A payment-restricted product is always movement-restricted.
  if coalesce(new.wallet_eligibility_status, '') = 'restricted' then
    new.inventory_movement_status := 'restricted';
    new.inventory_movement_reviewed_at := now();
    new.inventory_movement_reviewed_by := 'system';
  elsif tg_op = 'UPDATE'
        and not v_trusted_role
        and new.inventory_movement_status is distinct from v_previous_status then
    raise exception
      'Inventory movement status requires a trusted server role';
  end if;

  if new.inventory_movement_status = 'allowed'
     and coalesce(new.wallet_eligibility_status, '') <> 'eligible' then
    raise exception
      'Only reviewed eligible products can be allowed for inventory movement';
  end if;

  -- Audit metadata cannot be edited independently by browser/API callers.
  if tg_op = 'UPDATE'
     and not v_trusted_role
     and new.inventory_movement_status is not distinct from v_previous_status
     and (
       new.inventory_movement_reviewed_at
         is distinct from old.inventory_movement_reviewed_at
       or new.inventory_movement_reviewed_by
         is distinct from old.inventory_movement_reviewed_by
     ) then
    raise exception
      'Inventory movement audit metadata is server controlled';
  end if;

  if new.inventory_movement_status is distinct from v_previous_status then
    new.inventory_movement_reviewed_at := now();

    if new.inventory_movement_status = 'restricted'
       and coalesce(new.wallet_eligibility_status, '') = 'restricted' then
      new.inventory_movement_reviewed_by := 'system';
    else
      new.inventory_movement_reviewed_by := current_user;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_inventory_movement_quarantine
  on public.products;

create trigger trg_products_inventory_movement_quarantine
before insert or update of
  wallet_eligibility_status,
  inventory_movement_status,
  inventory_movement_reviewed_at,
  inventory_movement_reviewed_by
on public.products
for each row
execute function public.enforce_inventory_movement_quarantine();

create or replace function public.validate_stock_transfer_allowed_products()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_product_id text;
  v_status text;
begin
  if jsonb_typeof(coalesce(new.items, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(new.items, '[]'::jsonb)) = 0 then
    raise exception 'A stock transfer requires at least one product';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(new.items)
  loop
    v_product_id := nullif(btrim(v_item ->> 'productId'), '');

    if v_product_id is null then
      raise exception 'Every stock transfer item requires a productId';
    end if;

    select inventory_movement_status
    into v_status
    from public.products
    where id = v_product_id;

    if not found then
      raise exception 'Stock transfer product does not exist';
    end if;

    if coalesce(v_status, 'unreviewed') <> 'allowed' then
      raise exception
        'Product is not approved for inventory movement';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_stock_transfers_allowed_products
  on public.stock_transfers;

create trigger trg_stock_transfers_allowed_products
before insert or update of items, origin, destination, status
on public.stock_transfers
for each row
execute function public.validate_stock_transfer_allowed_products();

revoke all on function public.enforce_inventory_movement_quarantine()
  from public, anon, authenticated;

revoke all on function public.validate_stock_transfer_allowed_products()
  from public, anon, authenticated;

grant execute on function public.enforce_inventory_movement_quarantine()
  to service_role;

grant execute on function public.validate_stock_transfer_allowed_products()
  to service_role;

comment on column public.products.inventory_movement_status is
  'Quarantine status for inventory visibility and transfer operations.';

comment on function public.validate_stock_transfer_allowed_products() is
  'Rejects stock transfers containing unreviewed or restricted products.';
