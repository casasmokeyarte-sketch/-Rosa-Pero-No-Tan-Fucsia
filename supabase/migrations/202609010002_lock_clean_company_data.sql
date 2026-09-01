-- The clean installation keeps business data behind wallet-api. Browser anon
-- keys cannot read or write customer, employee, inventory or billing tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_config',
    'users',
    'clients',
    'products',
    'invoices',
    'shifts',
    'expenses',
    'stock_adjustments',
    'stock_transfers',
    'chat_messages',
    'client_requests',
    'discounts',
    'flash_messages',
    'flash_views',
    'payroll_entries'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end;
$$;

comment on table public.business_config is
  'Private company configuration served through the allowlisted wallet-api.';
