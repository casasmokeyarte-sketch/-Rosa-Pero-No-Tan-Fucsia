-- ============================================================
--  Rosa Pero No Tan Fucsia – Supabase Database Schema Update
--  Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Sonido y Tonos Personalizados para Clientes y Configuración General
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS chat_sound_tone text DEFAULT 'Predeterminado',
ADD COLUMN IF NOT EXISTS notif_sound_tone text DEFAULT 'Predeterminado';

ALTER TABLE business_config 
ADD COLUMN IF NOT EXISTS sound_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS chat_sound_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notif_sound_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS default_tone text DEFAULT 'Predeterminado';


-- 2. Tabla de Promociones y Descuentos
CREATE TABLE IF NOT EXISTS discounts (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text CHECK (type IN ('porcentaje', 'fijo')) NOT NULL,
  value numeric(12,2) NOT NULL,
  active boolean DEFAULT true,
  start_date date,
  end_date date,
  start_time text, -- Formato 'HH:MM'
  end_time text,   -- Formato 'HH:MM'
  active_days integer[], -- Ejemplo: array[1,2,3] (0=Domingo, 1=Lunes, etc.)
  applies_to text CHECK (applies_to IN ('todos', 'facturacion', 'domicilios')) DEFAULT 'todos',
  created_at timestamptz DEFAULT now()
);


-- 3. Tabla de Recordatorios Flash (Publicidad/Avisos)
CREATE TABLE IF NOT EXISTS flash_messages (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  target text CHECK (target IN ('operadores', 'clientes', 'ambos')) NOT NULL,
  attachment_url text, -- Base64 o URL pública del archivo
  attachment_type text CHECK (attachment_type IN ('image', 'video', 'file')),
  attachment_name text,
  max_views integer NOT NULL DEFAULT 1,
  active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);


-- 4. Tabla de Vistas de Anuncios Flash (Para limitar visualizaciones)
CREATE TABLE IF NOT EXISTS flash_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_id text REFERENCES flash_messages(id) ON DELETE CASCADE,
  viewer_id text NOT NULL, -- Nombre de usuario de operador o id de cliente
  views_count integer DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(flash_id, viewer_id)
);


-- 5. Tabla de Historial de Nómina de Operadores
CREATE TABLE IF NOT EXISTS payroll_entries (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  user_role text NOT NULL,
  period text NOT NULL, -- Formato 'YYYY-MM'
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  overtime_hours numeric(5,2) NOT NULL DEFAULT 0,
  overtime_rate numeric(12,2) NOT NULL DEFAULT 0,
  bonuses jsonb DEFAULT '[]', -- Formato: [{concept: string, amount: number}]
  deductions jsonb DEFAULT '[]', -- Formato: [{concept: string, amount: number}]
  payment_date date NOT NULL,
  payment_method text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by text NOT NULL
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_payroll_user ON payroll_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_flash_views_viewer ON flash_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(active);

-- ============================================================
-- 6. Columnas faltantes para adaptar el esquema a la estructura de la aplicación React
-- ============================================================

-- En la tabla 'products' (para soportar gramaje y stock por usuario)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS special_price_1g numeric(12,2),
ADD COLUMN IF NOT EXISTS special_price_half_g numeric(12,2),
ADD COLUMN IF NOT EXISTS special_price_quarter_g numeric(12,2),
ADD COLUMN IF NOT EXISTS user_stocks jsonb DEFAULT '{}';

-- En la tabla 'invoices' (para firmas, métodos de entrega y guías de mensajería)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS client_signature text,
ADD COLUMN IF NOT EXISTS delivery_method text,
ADD COLUMN IF NOT EXISTS guide_name text,
ADD COLUMN IF NOT EXISTS guide_rut text,
ADD COLUMN IF NOT EXISTS guide_phone text,
ADD COLUMN IF NOT EXISTS guide_notes text;

-- En la tabla 'expenses' (para el método de pago del egreso)
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS payment_method text;

-- En la tabla 'chat_messages' (para registrar cuál agente envió/respondió el chat)
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS agent_id text;

-- ============================================================
-- 7. Nueva tabla de Traspasos de Inventario (para historiales de traspaso)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_transfers (
  id text PRIMARY KEY,
  origin text NOT NULL,
  destination text NOT NULL,
  origin_name text NOT NULL,
  destination_name text NOT NULL,
  items jsonb DEFAULT '[]',
  status text CHECK (status IN ('pendiente', 'aprobado', 'rechazado')) DEFAULT 'pendiente',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  support_notes text
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_origin ON stock_transfers(origin);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_destination ON stock_transfers(destination);

-- Desactivar RLS para que la aplicación frontend (con clave anon) pueda leer/escribir traspasos sin error 401
ALTER TABLE stock_transfers DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 8. Columna 'code' en la tabla 'clients' para Código de Acceso Único y Credenciales Biométricas
-- ============================================================
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS code text,
ADD COLUMN IF NOT EXISTS passkey_credential jsonb;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS passkey_credential jsonb;

-- Generar códigos aleatorios únicos (CL-XXXX) para clientes existentes que no tengan código
UPDATE clients 
SET code = 'CL-' || floor(random() * 9000 + 1000)::text 
WHERE code IS NULL;

-- 9. Columnas faltantes en la tabla 'clients' para soportar créditos, descuentos especiales y perfil de empleado
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS has_credit boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_employee boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS special_discount_percentage numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discounted_product_ids jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS credit_terms_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS credit_conditions text DEFAULT '';
    

-- ============================================================
-- 10. Columnas faltantes en la tabla 'invoices' para evitar fallas en inserciones de compras web
-- ============================================================
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS guide_address text,
ADD COLUMN IF NOT EXISTS card_fee numeric(12,2) DEFAULT 0;
