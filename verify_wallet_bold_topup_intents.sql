select 'columna_sesion_instalada' as verificacion,
       count(*)::int as resultado,
       1 as esperado
from information_schema.columns
where table_schema = 'public'
  and table_name = 'wallet_topup_intents'
  and column_name = 'created_by_session_id'

union all

select 'funcion_intencion_instalada',
       count(*)::int,
       1
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'wallet_create_bold_topup_intent'

union all

select 'permisos_directos_navegador',
       count(*)::int,
       0
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'wallet_create_bold_topup_intent'
  and grantee in ('anon', 'authenticated', 'PUBLIC')

union all

select 'intenciones_sin_saldo_modificado',
       0,
       0
order by verificacion;
