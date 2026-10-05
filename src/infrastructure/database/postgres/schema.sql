-- =====================================================================
-- TRIWYN POS — PostgreSQL / Supabase Production Cloud Database Schema
-- Parity matching for Offline Sync Engine and Multi-Terminal Aggregation
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Businesses & Locations
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  tax_number VARCHAR(100),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  currency_symbol VARCHAR(10) NOT NULL DEFAULT '$',
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  is_main BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  mac_address VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Security & RBAC
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  module VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255),
  password_hash TEXT NOT NULL,
  pin_hash TEXT,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Product Catalog
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  short_name VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  category_id UUID REFERENCES categories(id),
  unit_id UUID REFERENCES units(id),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL UNIQUE,
  barcode VARCHAR(100),
  brand VARCHAR(100),
  description TEXT,
  cost_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
  selling_price NUMERIC(15, 4) NOT NULL,
  wholesale_price NUMERIC(15, 4),
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  stock_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
  min_stock_level NUMERIC(15, 4) NOT NULL DEFAULT 5,
  reorder_level NUMERIC(15, 4) NOT NULL DEFAULT 10,
  track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
  track_expiry BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pg_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_pg_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_pg_products_name ON products(name);

-- 4. Inventory Ledger Movements
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id),
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID,
  movement_type VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50),
  reference_id VARCHAR(100),
  quantity_change NUMERIC(15, 4) NOT NULL,
  previous_quantity NUMERIC(15, 4) NOT NULL,
  new_quantity NUMERIC(15, 4) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Sales & Idempotency Key Tracking
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_transaction_id VARCHAR(100) NOT NULL UNIQUE, -- Crucial for Idempotency
  business_id UUID NOT NULL REFERENCES businesses(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  terminal_id UUID NOT NULL REFERENCES terminals(id),
  user_id UUID NOT NULL REFERENCES users(id),
  customer_id UUID,
  shift_id UUID NOT NULL,
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  subtotal NUMERIC(15, 4) NOT NULL,
  discount_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15, 4) NOT NULL,
  paid_amount NUMERIC(15, 4) NOT NULL,
  change_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID,
  product_name VARCHAR(255) NOT NULL,
  unit_price NUMERIC(15, 4) NOT NULL,
  cost_price NUMERIC(15, 4) NOT NULL,
  quantity NUMERIC(15, 4) NOT NULL,
  discount_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method_id VARCHAR(100) NOT NULL,
  method_code VARCHAR(50) NOT NULL,
  amount NUMERIC(15, 4) NOT NULL,
  reference_number VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Permanent Audit Logs & Approval Rules
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  user_name VARCHAR(255),
  role_name VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100),
  entity_id VARCHAR(255),
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  authorizer_id UUID REFERENCES users(id),
  authorizer_name VARCHAR(255),
  device_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  rule_type VARCHAR(100) NOT NULL,
  min_value NUMERIC(15, 4) NOT NULL DEFAULT 0,
  max_value NUMERIC(15, 4) NOT NULL DEFAULT 0,
  required_role VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pg_sales_client_tx ON sales(client_transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- 6. Supabase Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own business tenant data
CREATE POLICY business_isolation_users ON users
  FOR ALL USING (business_id = current_setting('app.current_business_id', true)::uuid);

CREATE POLICY business_isolation_sales ON sales
  FOR ALL USING (business_id = current_setting('app.current_business_id', true)::uuid);

CREATE POLICY business_isolation_products ON products
  FOR ALL USING (business_id = current_setting('app.current_business_id', true)::uuid);

-- Audit logs are append-only / read-only for non-superadmins
CREATE POLICY audit_logs_read_policy ON audit_logs
  FOR SELECT USING (true);

CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT WITH CHECK (true);

