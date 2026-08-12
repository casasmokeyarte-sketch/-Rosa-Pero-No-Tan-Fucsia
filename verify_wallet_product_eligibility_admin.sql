with checks as (
  select 'columnas_clasificacion_instaladas'::text as verificacion,
         count(*)::bigint as resultado,
         4::bigint as esperado
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'products'
    and column_name in (
      'wallet_eligibility_status',
      'wallet_eligibility_note',
      'wallet_eligibility_reviewed_by_user_id',
      'wallet_eligibility_reviewed_at'
    )

  union all

  select 'tabla_auditoria_instalada',
         count(*)::bigint,
         1::bigint
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'wallet_product_eligibility_audit'

  union all

  select 'funcion_clasificacion_instalada',
         count(*)::bigint,
         1::bigint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'set_wallet_product_eligibility'

  union all

  select 'tabla_auditoria_con_rls',
         count(*)::bigint,
         1::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'wallet_product_eligibility_audit'
    and c.relrowsecurity

  union all

  select 'permisos_directos_navegador',
         count(*)::bigint,
         0::bigint
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'wallet_product_eligibility_audit'
    and grantee in ('anon', 'authenticated')

  union all

  select 'productos_habilitados_sin_revision',
         count(*)::bigint,
         0::bigint
  from public.products
  where wallet_eligible
    and (
      wallet_eligibility_status <> 'eligible'
      or wallet_eligibility_reviewed_at is null
      or wallet_eligibility_reviewed_by_user_id is null
    )
)
select * from checks order by verificacion;
