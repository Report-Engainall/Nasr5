/*
# P3: Order revision cycle + restore RLS on finance tables

1. Purpose
- Adds the customer↔merchant order revision cycle: a customer requests changes to an order
  (reason + per-item quantities), the merchant reviews it in the order detail screen, and on
  approval a NEW order is created that references the original (no history is overwritten).
- Restores missing RLS + grants on the finance tables (cash_accounts, cash_movements, payments,
  purchase_orders, purchase_order_items) which were found disabled.

2. New Tables
- `order_revisions` — one row per customer revision request:
  organization_id, order_id (FK), revision_number, reason (required), items jsonb snapshot of the
  requested quantities, status ('pending' | 'approved' | 'rejected'), new_order_id (set on approval),
  requested_phone (verification), decided_at, created_at.

3. Security
- RLS enabled on order_revisions; policies SELECT/INSERT/UPDATE/DELETE for anon + authenticated
  (single-tenant app pattern used across this project).
- RLS re-enabled on the five finance tables with the same 4-policy pattern + full CRUD grants.
*/

CREATE TABLE IF NOT EXISTS order_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  revision_number integer NOT NULL DEFAULT 1,
  reason text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  new_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  requested_phone text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_revisions_order ON order_revisions (order_id, status);

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'cash_accounts','cash_movements','payments','purchase_orders','purchase_order_items','order_revisions'
  ) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "select_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "select_%s" ON %I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "insert_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "update_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "delete_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON cash_accounts, cash_movements, payments, purchase_orders, purchase_order_items, order_revisions TO anon, authenticated;
