select 'alcances_promocion_instalados' as verificacion,
       count(*)::text as resultado,
       '1' as esperado
from pg_constraint
where conrelid = 'public.discounts'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) like '%primera_compra_web%'
  and pg_get_constraintdef(oid) like '%web%'

union all

select 'columnas_direccion_verificada',
       count(*)::text,
       '2'
from information_schema.columns
where table_schema = 'public'
  and table_name = 'invoices'
  and column_name in ('delivery_address_place_id', 'delivery_address_verified')

union all

select 'funcion_wallet_actualizada',
       count(*)::text,
       '1'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'wallet_purchase_invoice'
  and pg_get_functiondef(p.oid) like '%primera_compra_web%'

union all

select 'promociones_primera_compra_existentes',
       count(*)::text,
       'informativo'
from public.discounts
where applies_to = 'primera_compra_web'

order by verificacion;
