-- ============================================================
--  Rosa Pero No Tan Fucsia – Supabase Database Schema
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── business_config ────────────────────────────────────────
create table if not exists business_config (
  id              text primary key default 'singleton',
  company_name    text not null,
  rut             text not null,
  address         text,
  phone           text,
  email           text,
  invoice_prefix  text default 'EXT',
  tax_rate        numeric(5,2) default 19,
  currency        text default 'USD',
  payment_methods jsonb default '[]',
  product_categories jsonb default '[]',
  updated_at      timestamptz default now()
);

-- ─── users (operadores) ─────────────────────────────────────
create table if not exists users (
  id          text primary key,
  username    text unique not null,
  full_name   text not null,
  role        text check (role in ('Administrador','Cajero')) default 'Cajero',
  status      text check (status in ('Activo','Inactivo')) default 'Activo',
  password    text,
  permissions jsonb default '{}',
  created_at  timestamptz default now()
);

-- ─── clients ────────────────────────────────────────────────
create table if not exists clients (
  id                  text primary key,
  name                text not null,
  document_type       text,
  rut                 text not null,
  email               text,
  phone               text,
  address             text,
  credit_limit        numeric(12,2) default 0,
  outstanding_balance numeric(12,2) default 0,
  assigned_agent_id   text references users(id) on delete set null,
  assigned_agent_name text,
  password            text,
  created_at          timestamptz default now()
);

-- ─── products ───────────────────────────────────────────────
create table if not exists products (
  id            text primary key,
  code          text unique not null,
  name          text not null,
  category      text,
  price         numeric(12,2) not null default 0,
  cost          numeric(12,2) not null default 0,
  stock         numeric(12,3) default 0,
  min_stock     numeric(12,3) default 0,
  image_url     text,
  unit_type     text default 'unidad',
  created_at    timestamptz default now()
);

-- ─── invoices ───────────────────────────────────────────────
create table if not exists invoices (
  id               text primary key,
  invoice_number   text not null,
  client_id        text references clients(id) on delete set null,
  client_name      text not null,
  client_rut       text,
  items            jsonb default '[]',
  subtotal         numeric(12,2) default 0,
  discount         numeric(12,2) default 0,
  tax_rate         numeric(5,2)  default 0,
  tax_amount       numeric(12,2) default 0,
  total            numeric(12,2) default 0,
  payment_method   text,
  payment_status   text default 'Pendiente',
  due_date         date,
  cashier_name     text,
  is_delivery      boolean default false,
  delivery_fee     numeric(12,2),
  delivery_rider   text,
  delivery_transport text,
  delivery_status  text default 'Pendiente',
  delivery_address text,
  notes            text,
  created_at       timestamptz default now()
);

-- ─── shifts (caja) ──────────────────────────────────────────
create table if not exists shifts (
  id             text primary key,
  "user"         text,
  start_time     timestamptz,
  end_time       timestamptz,
  initial_cash   numeric(12,2) default 0,
  sales_cash     numeric(12,2) default 0,
  sales_card     numeric(12,2) default 0,
  sales_credit   numeric(12,2) default 0,
  expenses_total numeric(12,2) default 0,
  expected_cash  numeric(12,2) default 0,
  actual_cash    numeric(12,2),
  discrepancy    numeric(12,2),
  status         text check (status in ('Abierta','Cerrada')) default 'Abierta',
  notes          text
);

-- ─── expenses ───────────────────────────────────────────────
create table if not exists expenses (
  id           text primary key,
  shift_id     text references shifts(id) on delete set null,
  description  text not null,
  amount       numeric(12,2) not null,
  category     text,
  cashier_name text,
  created_at   timestamptz default now()
);

-- ─── stock_adjustments ──────────────────────────────────────
create table if not exists stock_adjustments (
  id           text primary key,
  product_id   text references products(id) on delete cascade,
  product_name text,
  type         text,
  quantity     numeric(12,3),
  reason       text,
  "user"       text,
  created_at   timestamptz default now()
);

-- ─── chat_messages ──────────────────────────────────────────
create table if not exists chat_messages (
  id           text primary key,
  client_id    text references clients(id) on delete cascade,
  sender       text check (sender in ('client','agent')),
  sender_name  text,
  "text"       text,
  attachment   jsonb,
  timestamp    timestamptz default now()
);

-- ─── client_requests ────────────────────────────────────────
create table if not exists client_requests (
  id           text primary key,
  client_id    text references clients(id) on delete cascade,
  client_name  text,
  client_rut   text,
  type         text check (type in ('Sugerencia','Reclamo','Consulta','Solicitud')),
  subject      text not null,
  description  text,
  status       text default 'Pendiente',
  priority     text default 'Media',
  agent_notes  text,
  agent_id     text,
  created_at   timestamptz default now(),
  resolved_at  timestamptz
);

-- ─── Row Level Security (habilitar después de configurar Auth) ────────────────
-- alter table clients enable row level security;
-- alter table invoices enable row level security;
-- (etc.)

-- ─── Índices útiles ─────────────────────────────────────────
create index if not exists idx_invoices_client on invoices(client_id);
create index if not exists idx_chat_messages_client on chat_messages(client_id);
create index if not exists idx_client_requests_client on client_requests(client_id);
create index if not exists idx_stock_adj_product on stock_adjustments(product_id);
