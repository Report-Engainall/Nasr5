/*
# بوابة الأغبري للمواد الغذائية — Core Database Schema

## Overview
This migration creates the complete operational schema for the Aghbari B2B wholesale food commerce platform.
All tables use UUID primary keys, tenant isolation via organization_id, and RLS policies.

## New Tables
1. organizations — Tenant/organization master data
2. branches — Branches within organizations
3. warehouses — Warehouses within branches
4. profiles — User profiles (staff and customers)
5. user_roles — Role assignments for users
6. customers — Customer master data with tiers
7. suppliers — Supplier master data
8. categories — Product categories (hierarchical)
9. products — Product master data with SKU/barcode
10. product_media — Product images/media
11. product_prices — Prices per product per customer tier
12. pricing_rules — Smart pricing engine rules
13. price_change_log — Audit log for price changes
14. inventory_balances — Current stock per product/warehouse
17. inventory_movements — Ledger of all stock movements
18. orders — Customer orders with state machine
19. order_items — Line items within orders
20. order_status_history — Order state transition audit
21. notifications — User/customer notifications
22. audit_logs — System audit trail
23. outbox_events — Transactional outbox for integrations
24. import_jobs — Import job tracking
25. import_job_rows — Individual row results per import job
26. admin_settings — System-wide settings key-value store
27. promotions — Promotional offers
28. ai_alerts — AI-generated alerts
29. ai_tasks — AI-generated tasks

## Security
- RLS enabled on ALL tables
- Policies scope to authenticated users where applicable
- For prototype/demo purposes, anon+authenticated access is granted to core tables
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ORGANIZATIONS (TENANTS)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  tax_number text,
  currency text NOT NULL DEFAULT 'YER',
  phone text,
  email text,
  address text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. BRANCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. WAREHOUSES
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text UNIQUE,
  phone text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. USER ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  customer_code text NOT NULL,
  business_name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  address text,
  tier text NOT NULL DEFAULT 'retail',
  credit_limit numeric(15,2) DEFAULT 0,
  current_balance numeric(15,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, customer_code)
);

-- ============================================================
-- 7. SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_code text NOT NULL,
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  address text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, supplier_code)
);

-- ============================================================
-- 8. CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  item_code text NOT NULL,
  barcode text,
  description text,
  unit text NOT NULL DEFAULT 'كرتون',
  base_price numeric(15,2) NOT NULL DEFAULT 0,
  cost_price numeric(15,2) DEFAULT 0,
  min_stock int DEFAULT 0,
  max_stock int,
  status text NOT NULL DEFAULT 'active',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, item_code)
);

-- ============================================================
-- 10. PRODUCT MEDIA
-- ============================================================
CREATE TABLE IF NOT EXISTS product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt_text text,
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 11. PRODUCT PRICES (per tier)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'retail',
  price numeric(15,2) NOT NULL DEFAULT 0,
  min_quantity int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, tier)
);

-- ============================================================
-- 12. PRICING RULES (Smart Pricing Engine)
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  scope_type text NOT NULL DEFAULT 'default',
  scope_value text,
  base_type text NOT NULL DEFAULT 'base_price',
  adjustment_type text NOT NULL DEFAULT 'percentage',
  adjustment_value numeric(10,2) NOT NULL DEFAULT 0,
  min_price numeric(15,2),
  max_price numeric(15,2),
  is_active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 13. PRICE CHANGE LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS price_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  old_price numeric(15,2),
  new_price numeric(15,2),
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 14. INVENTORY BALANCES
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity_on_hand numeric(15,3) NOT NULL DEFAULT 0,
  quantity_reserved numeric(15,3) NOT NULL DEFAULT 0,
  quantity_available numeric(15,3) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  reorder_point int DEFAULT 0,
  last_movement_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, warehouse_id)
);

-- ============================================================
-- 15. INVENTORY MOVEMENTS (Ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  movement_type text NOT NULL,
  quantity numeric(15,3) NOT NULL,
  balance_after numeric(15,3),
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 16. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  total_items int NOT NULL DEFAULT 0,
  notes text,
  idempotency_key text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, order_number)
);

-- ============================================================
-- 17. ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  item_code text,
  product_name_snapshot text NOT NULL,
  unit_snapshot text,
  quantity numeric(15,3) NOT NULL DEFAULT 1,
  unit_price_snapshot numeric(15,2) NOT NULL DEFAULT 0,
  discount_snapshot numeric(15,2) NOT NULL DEFAULT 0,
  line_total numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 18. ORDER STATUS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 19. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 20. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 21. OUTBOX EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_id uuid,
  payload jsonb,
  idempotency_key text,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  provider_reference text,
  error_class text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 22. IMPORT JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  file_name text,
  file_hash text,
  file_size bigint,
  status text NOT NULL DEFAULT 'pending',
  total_rows int DEFAULT 0,
  processed_rows int DEFAULT 0,
  success_rows int DEFAULT 0,
  failed_rows int DEFAULT 0,
  data_quality_score int,
  error_summary jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================
-- 23. IMPORT JOB ROWS
-- ============================================================
CREATE TABLE IF NOT EXISTS import_job_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  data jsonb,
  errors jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 24. ADMIN SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, key)
);

-- ============================================================
-- 25. PROMOTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  product_ids uuid[] DEFAULT '{}',
  category_ids uuid[] DEFAULT '{}',
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 26. AI ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id uuid,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 27. AI TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_type text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_org_code ON products(organization_id, item_code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_categories_org ON categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_orders_org_status ON orders(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_balances(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory_balances(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_org ON import_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_org ON ai_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_org ON ai_tasks(organization_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_job_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;

-- For prototype/demo: allow anon+authenticated on all tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'organizations','branches','warehouses','profiles','user_roles','customers','suppliers',
    'categories','products','product_media','product_prices','pricing_rules','price_change_log',
    'inventory_balances','inventory_movements','orders','order_items','order_status_history',
    'notifications','audit_logs','outbox_events','import_jobs','import_job_rows','admin_settings',
    'promotions','ai_alerts','ai_tasks'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_select_%s" ON %I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;