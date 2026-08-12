-- Wallet product eligibility administration, NFC references and audit controls.
-- Eligibility remains false unless reviewed through the private Wallet API.

alter table public.products
  add column if not exists wallet_eligibility_status text not null default 'unreviewed'
    check (wallet_eligibility_status in ('unreviewed', 'eligible', 'restricted'));

alter table public.products
  add column if not exists wallet_eligibility_note text;

alter table public.products
  add column if not exists wallet_eligibility_reviewed_by_user_id text;

alter table public.products
  add column if not exists wallet_eligibility_reviewed_at timestamptz;

update public.products
set wallet_eligibility_status = case
  when wallet_eligible then 'eligible'
  else 'unreviewed'
end
where wallet_eligibility_status is null
   or (wallet_eligible and wallet_eligibility_status <> 'eligible');

create table if not exists public.wallet_product_eligibility_audit (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete restrict,
  previous_eligible boolean not null,
  new_eligible boolean not null,
  review_note text not null check (char_length(btrim(review_note)) >= 10),
  reviewed_by_user_id text not null,
  reviewed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_wallet_product_eligibility_audit_product
  on public.wallet_product_eligibility_audit(product_id, reviewed_at desc);

alter table public.wallet_product_eligibility_audit enable row level security;

revoke all on table public.wallet_product_eligibility_audit
  from public, anon, authenticated;
grant all on table public.wallet_product_eligibility_audit to service_role;

create or replace function public.protect_wallet_product_eligibility()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (
    new.wallet_eligible is distinct from old.wallet_eligible
    or new.wallet_eligibility_status is distinct from old.wallet_eligibility_status
    or new.wallet_eligibility_note is distinct from old.wallet_eligibility_note
    or new.wallet_eligibility_reviewed_by_user_id is distinct from old.wallet_eligibility_reviewed_by_user_id
    or new.wallet_eligibility_reviewed_at is distinct from old.wallet_eligibility_reviewed_at
  ) and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Wallet product eligibility requires an authorized server operation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_protect_wallet_eligibility on public.products;
create trigger trg_products_protect_wallet_eligibility
before update of
  wallet_eligible,
  wallet_eligibility_status,
  wallet_eligibility_note,
  wallet_eligibility_reviewed_by_user_id,
  wallet_eligibility_reviewed_at
on public.products
for each row execute function public.protect_wallet_product_eligibility();

create or replace function public.set_wallet_product_eligibility(
  p_product_id text,
  p_eligible boolean,
  p_review_note text,
  p_reviewed_by_user_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_previous boolean;
begin
  if char_length(btrim(coalesce(p_review_note, ''))) < 10 then
    raise exception 'Review note must contain at least 10 characters';
  end if;
  if btrim(coalesce(p_reviewed_by_user_id, '')) = '' then
    raise exception 'Reviewer is required';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  v_previous := coalesce(v_product.wallet_eligible, false);

  update public.products
  set
    wallet_eligible = p_eligible,
    wallet_eligibility_status = case when p_eligible then 'eligible' else 'restricted' end,
    wallet_eligibility_note = btrim(p_review_note),
    wallet_eligibility_reviewed_by_user_id = p_reviewed_by_user_id,
    wallet_eligibility_reviewed_at = now()
  where id = p_product_id
  returning * into v_product;

  insert into public.wallet_product_eligibility_audit (
    product_id,
    previous_eligible,
    new_eligible,
    review_note,
    reviewed_by_user_id,
    reviewed_at,
    metadata
  ) values (
    p_product_id,
    v_previous,
    p_eligible,
    btrim(p_review_note),
    p_reviewed_by_user_id,
    v_product.wallet_eligibility_reviewed_at,
    coalesce(p_metadata, '{}'::jsonb)
  );

  return jsonb_build_object(
    'id', v_product.id,
    'code', v_product.code,
    'name', v_product.name,
    'category', v_product.category,
    'wallet_eligible', v_product.wallet_eligible,
    'wallet_eligibility_status', v_product.wallet_eligibility_status,
    'wallet_eligibility_note', v_product.wallet_eligibility_note,
    'wallet_eligibility_reviewed_at', v_product.wallet_eligibility_reviewed_at
  );
end;
$$;

revoke all on function public.set_wallet_product_eligibility(
  text, boolean, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.set_wallet_product_eligibility(
  text, boolean, text, text, jsonb
) to service_role;

comment on table public.wallet_product_eligibility_audit is
  'Immutable administrative audit trail for product wallet eligibility decisions.';

comment on column public.products.wallet_eligibility_status is
  'Server-managed review state. Eligibility does not replace legal, identity or age controls.';
