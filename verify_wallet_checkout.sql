with checks as (
  select 'columna_producto_wallet_eligible' as verificacion,
         count(*)::text as resultado,
         '1' as esperado
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'products'
    and column_name = 'wallet_eligible'

  union all

  select 'columna_factura_wallet_paid_amount',
         count(*)::text,
         '1'
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'invoices'
    and column_name = 'wallet_paid_amount'

  union all

  select 'funcion_pago_wallet_instalada',
         count(*)::text,
         '1'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'wallet_purchase_invoice'

  union all

  select 'productos_habilitados_sin_revision',
         count(*)::text,
         '0'
  from public.products
  where wallet_eligible = true

  union all

  select 'permisos_directos_navegador',
         count(*)::text,
         '0'
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and routine_name = 'wallet_purchase_invoice'
    and grantee in ('anon', 'authenticated', 'PUBLIC')
)
select * from checks order by verificacion;
