-- ============================================================
--  EXTREME COURIER – Seed Data (Datos Iniciales)
--  Ejecutar DESPUÉS de schema.sql
--  Supabase Dashboard → SQL Editor → New query
-- ============================================================


-- ─── 1. CONFIGURACIÓN DE LA EMPRESA ─────────────────────────
insert into business_config (
  id, company_name, rut, address, phone, email,
  invoice_prefix, tax_rate, currency,
  payment_methods, product_categories
) values (
  'singleton',
  'Rosa Fuerte Pero NO Tan Fucsia',
  '901.884.202-6',
  'Búnker Comercial #77, Zona de Mitigación 3',
  '+57 (601) 999-4321',
  'operaciones@extremecourier.com',
  'EXT',
  19,
  'USD',
  '["Efectivo","Tarjeta","Crédito"]',
  '["Contenedores","Energía","Químicos","Dispositivos","Protección","Filtros","Botánica","Otros"]'
)
on conflict (id) do update set
  company_name       = excluded.company_name,
  rut                = excluded.rut,
  address            = excluded.address,
  phone              = excluded.phone,
  email              = excluded.email,
  invoice_prefix     = excluded.invoice_prefix,
  tax_rate           = excluded.tax_rate,
  currency           = excluded.currency,
  payment_methods    = excluded.payment_methods,
  product_categories = excluded.product_categories,
  updated_at         = now();


-- ─── 2. USUARIOS (OPERADORES) ───────────────────────────────
insert into users (id, username, full_name, role, status, password, permissions) values

-- Administrador principal
('u-1', 'admin', 'Comandante Alpha', 'Administrador', 'Activo', 'admin',
 '{
   "dashboard":true,"facturacion":true,"domicilios":true,"clientes":true,
   "inventario":true,"caja":true,"historial_cierres":true,"cartera":true,
   "gastos":true,"identificadortlf":true,"chatsoporte":true,"configuraciones":true,
   "solicitudes_clientes":true,
   "crear_factura":true,"editar_cliente":true,"eliminar_cliente":true,
   "ajustar_stock":true,"traspaso_inventario":true,"abrir_cerrar_caja":true,
   "registrar_gasto":true,"abonar_cartera":true,"modificar_configuracion":true,
   "gestionar_usuarios":true,
   "imprimir_facturas":true,"editar_facturas":true,"eliminar_facturas":true,
   "imprimir_clientes":true,"eliminar_inventario":true,"imprimir_inventario":true,
   "editar_gastos":true,"eliminar_gastos":true,"imprimir_gastos":true,
   "imprimir_cartera":true,"editar_domicilios":true,"imprimir_domicilios":true,
   "imprimir_cierres":true
 }'::jsonb),

-- Cajero 1
('u-2', 'cajero1', 'Agente Neon-Pink', 'Cajero', 'Activo', '1234',
 '{
   "dashboard":true,"facturacion":true,"domicilios":true,"clientes":true,
   "inventario":true,"caja":true,"historial_cierres":true,"cartera":false,
   "gastos":true,"identificadortlf":true,"chatsoporte":true,"configuraciones":false,
   "solicitudes_clientes":true,
   "crear_factura":true,"editar_cliente":true,"eliminar_cliente":false,
   "ajustar_stock":false,"traspaso_inventario":true,"abrir_cerrar_caja":true,
   "registrar_gasto":true,"abonar_cartera":false,"modificar_configuracion":false,
   "gestionar_usuarios":false,
   "imprimir_facturas":true,"editar_facturas":false,"eliminar_facturas":false,
   "imprimir_clientes":true,"eliminar_inventario":false,"imprimir_inventario":true,
   "editar_gastos":false,"eliminar_gastos":false,"imprimir_gastos":true,
   "imprimir_cartera":false,"editar_domicilios":true,"imprimir_domicilios":true,
   "imprimir_cierres":false
 }'::jsonb),

-- Cajero 2
('u-3', 'cajero2', 'Mensajero Reactor', 'Cajero', 'Activo', '1234',
 '{
   "dashboard":true,"facturacion":true,"domicilios":true,"clientes":true,
   "inventario":true,"caja":true,"historial_cierres":false,"cartera":false,
   "gastos":true,"identificadortlf":true,"chatsoporte":true,"configuraciones":false,
   "solicitudes_clientes":true,
   "crear_factura":true,"editar_cliente":false,"eliminar_cliente":false,
   "ajustar_stock":false,"traspaso_inventario":true,"abrir_cerrar_caja":true,
   "registrar_gasto":true,"abonar_cartera":false,"modificar_configuracion":false,
   "gestionar_usuarios":false,
   "imprimir_facturas":true,"editar_facturas":false,"eliminar_facturas":false,
   "imprimir_clientes":false,"eliminar_inventario":false,"imprimir_inventario":false,
   "editar_gastos":false,"eliminar_gastos":false,"imprimir_gastos":false,
   "imprimir_cartera":false,"editar_domicilios":true,"imprimir_domicilios":false,
   "imprimir_cierres":false
 }'::jsonb)

on conflict (id) do update set
  username    = excluded.username,
  full_name   = excluded.full_name,
  role        = excluded.role,
  status      = excluded.status,
  password    = excluded.password,
  permissions = excluded.permissions;


-- ─── 3. CLIENTES ────────────────────────────────────────────
insert into clients (
  id, name, document_type, rut,
  email, phone, address,
  credit_limit, outstanding_balance,
  password, created_at
) values

('c-ocasional', 'Cliente Ocasional', 'CC', '222.222.222-2',
 'ocasional@extremecourier.com', '+57 (300) 000-0000', 'Venta Directa de Caja',
 0, 0, '1234', '2026-01-01T00:00:00-05:00'),

('c-1', 'Corporación CyberDyne', 'NIT', '901.442.111-4',
 'suministros@cyberdyne.corp', '+57 (601) 334-1122',
 'Torre Principal de Innovación, Piso 42',
 2500.00, 850.00, '1234', '2026-01-15T08:00:00-05:00'),

('c-2', 'Sindicato de Mensajeros del Páramo', 'NIT', '800.512.663-9',
 'enlaces@paramocourier.org', '+57 (315) 888-2910',
 'Hangar de Tránsito, Autopista de Ceniza Km 12',
 1000.00, 0.00, '1234', '2026-02-10T10:30:00-05:00'),

('c-3', 'Laboratorios Weyland-Yutani', 'NIT', '902.120.887-1',
 'procurement@weyland.bio', '+57 (602) 445-5678',
 'Domo de Investigación Médica #3',
 5000.00, 450.00, '1234', '2026-03-01T14:15:00-05:00'),

('c-4', 'Elena Vance (Investigadora)', 'CC', '1.020.450.992-0',
 'elena.vance@resistencia.net', '+57 (320) 412-9988',
 'Subnivel 4, Laboratorios Black Mesa',
 500.00, 120.00, '1234', '2026-04-18T11:00:00-05:00'),

('c-5', 'Nakamura Trading Ltd', 'NIT', '700.334.881-2',
 'contact@nakamuratrading.jp', '+57 (601) 777-8899',
 'Distrito Financiero de Neón, Of. 909',
 3000.00, 0.00, '1234', '2026-05-22T09:45:00-05:00')

on conflict (id) do update set
  name                = excluded.name,
  document_type       = excluded.document_type,
  rut                 = excluded.rut,
  email               = excluded.email,
  phone               = excluded.phone,
  address             = excluded.address,
  credit_limit        = excluded.credit_limit,
  outstanding_balance = excluded.outstanding_balance,
  password            = excluded.password;


-- ─── 4. HISTORIAL DE FACTURAS (invoice_history) ─────────────
-- La tabla "invoices" ya existe en schema.sql.
-- Agrega facturas de ejemplo o usa esta plantilla:
--
-- insert into invoices (
--   id, invoice_number, client_id, client_name, client_rut,
--   items, subtotal, discount, tax_rate, tax_amount, total,
--   payment_method, payment_status, due_date, cashier_name,
--   is_delivery, created_at
-- ) values (
--   gen_random_uuid()::text,
--   'EXT-0010',
--   'c-1',                              -- ID del cliente
--   'Corporación CyberDyne',
--   '901.442.111-4',
--   '[{"productId":"p-1","productName":"Insumo","price":100,"quantity":2,"taxAmount":38,"total":200}]'::jsonb,
--   200.00,   -- subtotal
--   0.00,     -- descuento
--   19,       -- IVA %
--   38.00,    -- taxAmount
--   238.00,   -- total
--   'Efectivo',
--   'Pendiente',   -- 'Pagado' | 'Pendiente' | 'Vencido' | 'Anulada'
--   (now() + interval '15 days')::date,
--   'Comandante Alpha',
--   false,
--   now()
-- );

-- ── Anular una factura ───────────────────────────────────────
-- update invoices
-- set payment_status = 'Anulada',
--     notes = 'ANULADA por Admin — Motivo: duplicado — ' || now()::text
-- where invoice_number = 'EXT-0001';

-- ── Ver facturas por cliente ─────────────────────────────────
-- select i.invoice_number, i.client_name, i.total, i.payment_status, i.created_at
-- from invoices i
-- where i.client_id = 'c-1'
-- order by i.created_at desc;

-- ── Facturas del día ─────────────────────────────────────────
-- select * from invoices
-- where created_at::date = current_date
-- order by created_at desc;


-- ─── 5. CIERRES DE CAJA (shifts) ────────────────────────────
-- La tabla "shifts" ya existe en schema.sql.
-- Ejemplo de turno de apertura y cierre:

insert into shifts (
  id, "user", start_time, end_time,
  initial_cash, sales_cash, sales_card, sales_credit,
  expenses_total, expected_cash, actual_cash, discrepancy, status, notes
) values
('shift-seed-1', 'Comandante Alpha',
 '2026-07-05T08:00:00-05:00', '2026-07-05T18:00:00-05:00',
 500.00, 1200.00, 450.00, 300.00,
 85.00, 1615.00, 1615.00, 0.00,
 'Cerrada', 'Turno de prueba — datos semilla')
on conflict (id) do nothing;

-- ── Consultas útiles cierres ─────────────────────────────────
-- Ver todos los cierres con totales:
-- select id, "user", start_time, end_time,
--        (sales_cash + sales_card + sales_credit) as total_ventas,
--        discrepancy, status
-- from shifts
-- order by start_time desc;

-- Turno activo (abierto):
-- select * from shifts where status = 'Abierta' limit 1;


-- ─── 6. CATEGORÍAS DE PRODUCTOS ─────────────────────────────
-- Las categorías se almacenan en business_config.product_categories (JSONB).
-- Para leerlas:
-- select jsonb_array_elements_text(product_categories) as categoria
-- from business_config where id = 'singleton';

-- Para agregar una categoría nueva:
-- update business_config
-- set product_categories = product_categories || '["Nueva Categoría"]'::jsonb
-- where id = 'singleton';

-- Para reemplazar la lista completa:
-- update business_config
-- set product_categories = '["Contenedores","Energía","Químicos","Dispositivos","Protección","Filtros","Botánica","Alimentos","Otros"]'::jsonb
-- where id = 'singleton';

-- (Opcional) Si prefieres tabla independiente, agrégala al schema:
-- create table if not exists product_categories (
--   id   serial primary key,
--   name text unique not null
-- );
-- insert into product_categories (name) values
--   ('Contenedores'),('Energía'),('Químicos'),('Dispositivos'),
--   ('Protección'),('Filtros'),('Botánica'),('Otros')
-- on conflict (name) do nothing;


-- ─── 7. MÉTODOS DE PAGO ─────────────────────────────────────
-- Los métodos de pago se almacenan en business_config.payment_methods (JSONB).
-- Para leerlos:
-- select jsonb_array_elements_text(payment_methods) as metodo
-- from business_config where id = 'singleton';

-- Para agregar un método nuevo:
-- update business_config
-- set payment_methods = payment_methods || '["Transferencia"]'::jsonb
-- where id = 'singleton';

-- Para reemplazar la lista completa:
-- update business_config
-- set payment_methods = '["Efectivo","Tarjeta","Crédito","Transferencia","Nequi","Daviplata"]'::jsonb
-- where id = 'singleton';

-- (Opcional) Tabla independiente:
-- create table if not exists payment_methods (
--   id   serial primary key,
--   name text unique not null
-- );
-- insert into payment_methods (name) values
--   ('Efectivo'),('Tarjeta'),('Crédito'),('Transferencia'),('Nequi'),('Daviplata')
-- on conflict (name) do nothing;


-- ─── 8. PLANTILLAS: agregar nuevos usuarios y clientes ───────
-- Copia y pega este bloque para crear operadores adicionales:
--
-- insert into users (id, username, full_name, role, status, password, permissions)
-- values (
--   gen_random_uuid()::text,          -- ID automático
--   'nuevo_cajero',                    -- Username de login
--   'Nombre Completo del Cajero',
--   'Cajero',                          -- 'Cajero' o 'Administrador'
--   'Activo',
--   '1234',                            -- Contraseña inicial
--   '{
--     "dashboard":true,"facturacion":true,"domicilios":true,"clientes":true,
--     "inventario":true,"caja":true,"historial_cierres":false,"cartera":false,
--     "gastos":true,"identificadortlf":true,"chatsoporte":true,"configuraciones":false,
--     "solicitudes_clientes":true,
--     "crear_factura":true,"editar_cliente":false,"eliminar_cliente":false,
--     "ajustar_stock":false,"traspaso_inventario":true,"abrir_cerrar_caja":true,
--     "registrar_gasto":true,"abonar_cartera":false,"modificar_configuracion":false,
--     "gestionar_usuarios":false,
--     "imprimir_facturas":true,"editar_facturas":false,"eliminar_facturas":false,
--     "imprimir_clientes":false,"eliminar_inventario":false,"imprimir_inventario":false,
--     "editar_gastos":false,"eliminar_gastos":false,"imprimir_gastos":false,
--     "imprimir_cartera":false,"editar_domicilios":true,"imprimir_domicilios":false,
--     "imprimir_cierres":false
--   }'::jsonb
-- );


-- ─── 5. PLANTILLA: agregar nuevos clientes ───────────────────
-- Copia y pega este bloque para registrar clientes adicionales:
--
-- insert into clients (id, name, document_type, rut, email, phone, address,
--                      credit_limit, outstanding_balance, password, created_at)
-- values (
--   gen_random_uuid()::text,           -- ID automático
--   'Nombre del Cliente S.A.S.',
--   'NIT',                             -- CC | NIT | CE | PPT | PEP | TI | RC | Pasaporte
--   '900.123.456-7',
--   'correo@empresa.com',
--   '+57 (300) 000-0000',
--   'Dirección de facturación',
--   1000.00,                           -- Límite de crédito
--   0.00,                              -- Saldo deudor inicial
--   '1234',                            -- Contraseña del portal cliente
--   now()
-- );
