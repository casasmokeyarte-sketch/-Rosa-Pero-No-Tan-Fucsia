select 'tabla_eventos_instalada' as verificacion,
       case when to_regclass('public.wallet_webhook_events') is not null then 1 else 0 end as resultado,
       1 as esperado
union all
select 'funcion_procesamiento_instalada',
       case when to_regprocedure(
         'public.wallet_process_bold_event(text,text,text,text,text,numeric,text,text,timestamp with time zone,jsonb)'
       ) is not null then 1 else 0 end,
       1
union all
select 'tabla_eventos_con_rls',
       count(*)::int,
       1
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'wallet_webhook_events'
  and c.relrowsecurity
union all
select 'permisos_directos_navegador',
       count(*)::int,
       0
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'wallet_webhook_events'
  and grantee in ('anon', 'authenticated')
union all
select 'estados_revision_y_anulacion',
       count(*)::int,
       1
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'wallet_topup_intents'
  and con.conname = 'wallet_topup_intents_status_check'
  and pg_get_constraintdef(con.oid) like '%review_required%'
  and pg_get_constraintdef(con.oid) like '%voided%';
