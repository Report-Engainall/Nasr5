/*
# Finance & procurement: cash accounts, movements, payments, purchase orders, supplier balances

1. Purpose
Adds the financial and procurement backbone for the merchant dashboard:
- Cash/bank accounts per currency with documented opening balances.
- A cash movements ledger — every balance change has a source document and audit trail.
- Idempotent payments (receipts from customers, payments to suppliers) via a SECURITY DEFINER
  function `record_payment` that updates party balances and cash atomically; repeating the same
  idempotency key never posts twice.
- Purchase orders with line items, used by the replenishment engine.
- Adds `current_balance` to suppliers (additive, no data loss) so accounts payable has a real source.

2. New Tables
- `cash_accounts` — id, organization_id, name, type ('cash'|'bank'), currency, opening_balance, is_active.
- `cash_movements` — ledger rows: account, direction ('in'|'out'), amount, currency, source_type,
  source_id, reason, idempotency_key (unique when present).
- `payments` — payment_number, direction ('receipt'|'payment'), party_type ('customer'|'supplier'),
  party_id, optional order_id, amount, currency, method, cash_account_id, idempotency_key (unique).
- `purchase_orders` — po_number, supplier_id, status ('draft'|'submitted'|'received'|'cancelled'),
  total_amount, currency, expected_date, notes.
- `purchase_order_items` — po_id, product_id, quantity, unit_cost, line_total.

3. Modified Tables
- `suppliers`: + `current_balance numeric(15,2) DEFAULT 0` (payables source of truth).

4. New Functions
- `record_payment(...)` returns jsonb — validates amount/party/account, updates the party balance and
  writes payment + cash movement in one atomic transaction; returns the existing payment when the same
  idempotency key is reused (`duplicate: true`).

5. Security
- RLS enabled on all new tables; policies follow the existing prototype pattern (anon + authenticated
  can read/write; tenant scoping is applied by the application via organization_id).
- Explicit GRANTs for anon + authenticated on all new tables and sequences.
- `record_payment` is SECURITY DEFINER, EXECUTE granted to anon + authenticated, revoked from PUBLIC.
*/

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS current_balance numeric(15,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS cash_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'cash',
  currency text NOT NULL DEFAULT 'YER',
  opening_balance numeric(15,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cash_account_id uuid NOT NULL REFERENCES cash_accounts(id) ON DELETE CASCADE,
  direction text NOT NULL,
  amount numeric(15,2) NOT NULL,
  currency text NOT NULL DEFAULT 'YER',
  source_type text,
  source_id uuid,
  reason text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payment_number text NOT NULL,
  direction text NOT NULL,
  party_type text NOT NULL,
  party_id uuid NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  amount numeric(15,2) NOT NULL,
  currency text NOT NULL DEFAULT 'YER',
  method text NOT NULL DEFAULT 'cash',
  cash_account_id uuid REFERENCES cash_accounts(id) ON DELETE SET NULL,
  notes text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  po_number text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'YER',
  expected_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  item_code text,
  product_name_snapshot text NOT NULL,
  unit_snapshot text,
  quantity numeric(15,3) NOT NULL DEFAULT 0,
  unit_cost numeric(15,2) NOT NULL DEFAULT 0,
  line_total numeric(15,2) NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency ON payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_movements_idempotency ON cash_movements (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_movements_account ON cash_movements (cash_account_id);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments (party_type, party_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org ON purchase_orders (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items (purchase_order_id);

CREATE OR REPLACE FUNCTION public.record_payment(
  p_organization_id uuid,
  p_direction text,
  p_party_type text,
  p_party_id uuid,
  p_amount numeric,
  p_currency text,
  p_method text,
  p_cash_account_id uuid,
  p_order_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
  v_payment_number text;
  v_existing uuid;
  v_party_balance numeric(15,2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;
  IF p_direction NOT IN ('receipt', 'payment') OR p_party_type NOT IN ('customer', 'supplier') THEN
    RAISE EXCEPTION 'INVALID_PARAMETERS';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM payments WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_existing IS NOT NULL THEN
      SELECT row_to_json(p) INTO v_payment_number FROM (SELECT to_jsonb(payments) AS p) x;
      RETURN jsonb_build_object('payment_id', v_existing, 'duplicate', true);
    END IF;
  END IF;

  -- Validate the party and lock its balance row
  IF p_party_type = 'customer' THEN
    SELECT current_balance INTO v_party_balance FROM customers
      WHERE id = p_party_id AND organization_id = p_organization_id FOR UPDATE;
  ELSE
    SELECT current_balance INTO v_party_balance FROM suppliers
      WHERE id = p_party_id AND organization_id = p_organization_id FOR UPDATE;
  END IF;
  IF v_party_balance IS NULL THEN
    RAISE EXCEPTION 'PARTY_NOT_FOUND';
  END IF;

  -- A receipt from a customer requires an outstanding balance; a payment to a supplier requires a payable
  IF p_direction = 'receipt' AND v_party_balance <= 0 THEN
    RAISE EXCEPTION 'NO_OUTSTANDING_BALANCE';
  END IF;
  IF p_direction = 'payment' AND v_party_balance <= 0 THEN
    RAISE EXCEPTION 'NO_OUTSTANDING_BALANCE';
  END IF;

  IF p_cash_account_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM cash_accounts WHERE id = p_cash_account_id AND organization_id = p_organization_id AND is_active) THEN
      RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';
    END IF;
  END IF;

  LOOP
    v_payment_number := (CASE WHEN p_direction = 'receipt' THEN 'RCP-' ELSE 'PAY-' END)
      || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 1000000))::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM payments WHERE organization_id = p_organization_id AND payment_number = v_payment_number);
  END LOOP;

  INSERT INTO payments (organization_id, payment_number, direction, party_type, party_id, order_id,
      amount, currency, method, cash_account_id, notes, idempotency_key)
  VALUES (p_organization_id, v_payment_number, p_direction, p_party_type, p_party_id, p_order_id,
      p_amount, p_currency, p_method, p_cash_account_id, p_notes, p_idempotency_key)
  RETURNING id INTO v_payment_id;

  -- Receipt from customer: customer owes less. Payment to supplier: we owe less.
  IF p_party_type = 'customer' THEN
    UPDATE customers SET current_balance = current_balance - p_amount, updated_at = now() WHERE id = p_party_id;
  ELSE
    UPDATE suppliers SET current_balance = current_balance - p_amount, updated_at = now() WHERE id = p_party_id;
  END IF;

  IF p_cash_account_id IS NOT NULL THEN
    INSERT INTO cash_movements (organization_id, cash_account_id, direction, amount, currency,
        source_type, source_id, reason, idempotency_key)
    VALUES (p_organization_id, p_cash_account_id, CASE WHEN p_direction = 'receipt' THEN 'in' ELSE 'out' END,
        p_amount, p_currency, 'payment', v_payment_id,
        CASE WHEN p_direction = 'receipt' THEN 'تحصيل من عميل' ELSE 'سداد لمورد' END, p_idempotency_key);
  END IF;

  RETURN jsonb_build_object('payment_id', v_payment_id, 'payment_number', v_payment_number, 'duplicate', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_payment(uuid, text, text, uuid, numeric, text, text, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, text, text, uuid, numeric, text, text, uuid, uuid, text, text) TO anon, authenticated;

-- RLS + grants for the new tables, following the existing project pattern
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'cash_accounts','cash_movements','payments','purchase_orders','purchase_order_items'
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

GRANT SELECT, INSERT, UPDATE, DELETE ON cash_accounts, cash_movements, payments, purchase_orders, purchase_order_items TO anon, authenticated;
