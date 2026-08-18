-- Permanent server-side restriction for online payment eligibility.
-- Restricted products cannot be enabled by a browser, API mistake or direct SQL update.

create or replace function public.enforce_restricted_web_checkout()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_product_text text;
  v_is_restricted boolean;
begin
  v_product_text := lower(
    coalesce(new.name, '') || ' ' || coalesce(new.category, '')
  );

  v_is_restricted := v_product_text ~ (
    'tabaco|nicotina|cigarr|vape|vaporiz|bong|pipa|' ||
    'cannabis|marihuana|weed|blunt|papel fumar|encendedor|' ||
    'licor|cerveza|vino|tatuaje|tattoo|piercing|aguja|tinta tatuar'
  );

  if v_is_restricted then
    new.wallet_eligible := false;
    new.wallet_eligibility_status := 'restricted';
  elsif coalesce(new.wallet_eligible, false)
        and coalesce(new.wallet_eligibility_status, '') <> 'eligible' then
    raise exception
      'Eligible online-payment products must have eligibility status eligible';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_enforce_restricted_web_checkout
  on public.products;

create trigger trg_products_enforce_restricted_web_checkout
before insert or update of
  name,
  category,
  wallet_eligible,
  wallet_eligibility_status
on public.products
for each row
execute function public.enforce_restricted_web_checkout();

update public.products
set
  wallet_eligible = false,
  wallet_eligibility_status = 'restricted'
where lower(
  coalesce(name, '') || ' ' || coalesce(category, '')
) ~ (
  'tabaco|nicotina|cigarr|vape|vaporiz|bong|pipa|' ||
  'cannabis|marihuana|weed|blunt|papel fumar|encendedor|' ||
  'licor|cerveza|vino|tatuaje|tattoo|piercing|aguja|tinta tatuar'
);

revoke all on function public.enforce_restricted_web_checkout()
  from public, anon, authenticated;

grant execute on function public.enforce_restricted_web_checkout()
  to service_role;

comment on function public.enforce_restricted_web_checkout() is
  'Forces restricted products out of all online-payment eligibility paths.';