-- Permite orientar promociones generales específicamente al portal de compras web.
alter table public.discounts
  drop constraint if exists discounts_applies_to_check;

alter table public.discounts
  add constraint discounts_applies_to_check
  check (applies_to in ('todos', 'facturacion', 'domicilios', 'compras_web'));
