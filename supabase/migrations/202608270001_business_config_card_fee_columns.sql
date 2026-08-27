-- Keep business configuration saves compatible with the card-fee fields
-- already sent by the application.
alter table public.business_config
  add column if not exists card_fee_percentage numeric(5,2) not null default 0,
  add column if not exists card_fee_enabled boolean not null default false;
