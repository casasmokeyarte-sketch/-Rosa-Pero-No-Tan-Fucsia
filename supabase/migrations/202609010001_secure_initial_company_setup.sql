-- Creates the first company and administrator atomically. This function is
-- private to the service role and permanently locks itself after first use.
create or replace function public.complete_initial_company_setup(
  p_company_name text,
  p_commercial_name text,
  p_rut text,
  p_city text,
  p_address text,
  p_phone text,
  p_email text,
  p_website text,
  p_slogan text,
  p_logo_url text,
  p_invoice_prefix text,
  p_tax_rate numeric,
  p_currency text,
  p_payment_methods jsonb,
  p_product_categories jsonb,
  p_admin_username text,
  p_admin_full_name text,
  p_admin_password text,
  p_admin_permissions jsonb
)
returns table (company_id text, administrator_id text)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext('rosa_initial_company_setup'));

  if exists (select 1 from public.users)
     or exists (
       select 1
       from public.business_config
       where id = 'singleton' and setup_complete is true
     ) then
    raise exception 'SETUP_ALREADY_COMPLETED';
  end if;

  insert into public.users (
    id, username, full_name, role, status, password, permissions
  ) values (
    'bootstrap-admin', p_admin_username, p_admin_full_name,
    'Administrador', 'Activo', p_admin_password, p_admin_permissions
  );

  insert into public.business_config (
    id, company_name, commercial_name, slogan, city, website, logo_url,
    setup_complete, rut, address, phone, email, invoice_prefix, tax_rate,
    currency, payment_methods, product_categories, card_fee_percentage,
    card_fee_enabled, updated_at
  ) values (
    'singleton', p_company_name, p_commercial_name, p_slogan, p_city,
    p_website, p_logo_url, true, p_rut, p_address, p_phone, p_email,
    p_invoice_prefix, p_tax_rate, p_currency, p_payment_methods,
    p_product_categories, 0, false, now()
  );

  return query select 'singleton'::text, 'bootstrap-admin'::text;
end;
$$;

revoke all on function public.complete_initial_company_setup(
  text, text, text, text, text, text, text, text, text, text, text,
  numeric, text, jsonb, jsonb, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.complete_initial_company_setup(
  text, text, text, text, text, text, text, text, text, text, text,
  numeric, text, jsonb, jsonb, text, text, text, jsonb
) to service_role;

comment on function public.complete_initial_company_setup(
  text, text, text, text, text, text, text, text, text, text, text,
  numeric, text, jsonb, jsonb, text, text, text, jsonb
) is 'One-time atomic bootstrap for a clean company installation.';
