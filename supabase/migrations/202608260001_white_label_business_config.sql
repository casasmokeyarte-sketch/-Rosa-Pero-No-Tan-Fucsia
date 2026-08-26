-- Datos de marca blanca para instalaciones independientes.
-- Es aditivo y conserva la configuración actual de Casa Smoke.

alter table public.business_config
  add column if not exists commercial_name text,
  add column if not exists slogan text,
  add column if not exists city text,
  add column if not exists website text,
  add column if not exists logo_url text,
  add column if not exists setup_complete boolean not null default false;

update public.business_config
set
  commercial_name = coalesce(nullif(commercial_name, ''), company_name),
  setup_complete = true
where id = 'singleton';

comment on column public.business_config.logo_url is
  'URL pública o data URL de un logo de máximo 1 MB.';
