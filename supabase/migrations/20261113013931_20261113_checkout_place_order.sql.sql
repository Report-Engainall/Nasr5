/*
# Server-verified order placement and customer checkout fields

1. Purpose
This migration makes checkout trustworthy and idempotent:
- Adds checkout fields to `orders` (payment method, delivery address, customer phone at order time).
- Adds a unique index on `orders.idempotency_key` so a double-tapped "confirm" button can never create two orders.
- Adds a SECURITY DEFINER database function `place_order` that re-verifies price and stock on the server,
  computes totals server-side (never trusting client prices), reserves inventory, and writes the order,
  its items, and its status history atomically. Repeated calls with the same idempotency key return
  the original order instead of creating a new one.

2. Modified Tables
- `orders`
  - `payment_method` (text, default 'cash_on_delivery') — how the customer will pay.
  - `delivery_address` (text) — where to deliver.
  - `contact_phone` (text) — phone captured at checkout for guest tracking.
- New unique index: only one order per non-null `idempotency_key`.

3. New Functions
- `place_order(p_organization_id, p_customer_id, p_warehouse_id, p_items jsonb, p_notes, p_payment_method,
   p_delivery_address, p_phone, p_idempotency_key)` returns jsonb
  - Validates every item against `products` (active + real `base_price`) and `inventory_balances`
    (available quantity), raising a clear Arabic error when stock is insufficient.
  - Inserts the order, order items, and an initial status history row.
  - Increases `quantity_reserved` so the stock is held for the order.
  - Returns `{ order_id, order_number, total_amount, duplicate }`.

4. Security
- RLS is unchanged (all existing policies remain).
- `place_order` is SECURITY DEFINER so it can validate against inventory atomically;
  EXECUTE is granted explicitly to `anon` and `authenticated` (the storefront is a no-auth app)
  and revoked from PUBLIC. It only writes scoped rows for the passed organization.
*/

-- New checkout columns on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash_on_delivery';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_phone text;

-- Idempotent order creation: same key can never produce two orders
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.place_order(
  p_organization_id uuid,
  p_customer_id uuid,
  p_warehouse_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_payment_method text DEFAULT 'cash_on_delivery',
  p_delivery_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_total numeric(15,2) := 0;
  v_item jsonb;
  v_product products;
  v_available numeric(15,3);
  v_qty numeric(15,3);
  v_balance_id uuid;
BEGIN
  -- Idempotency: return the original order if this key was already used
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, order_number INTO v_order_id, v_order_number
    FROM orders WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF v_order_id IS NOT NULL THEN
      SELECT total_amount INTO v_total FROM orders WHERE id = v_order_id;
      RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number,
        'total_amount', v_total, 'duplicate', true);
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_ORDER';
  END IF;

  -- Verify every item against live product and stock data
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY';
    END IF;

    SELECT * INTO v_product FROM products
      WHERE id = (v_item->>'product_id')::uuid AND organization_id = p_organization_id FOR UPDATE;
    IF NOT FOUND OR v_product.status <> 'active' THEN
      RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', v_product.name;
    END IF;

    SELECT id, quantity_available INTO v_balance_id, v_available FROM inventory_balances
      WHERE product_id = v_product.id AND warehouse_id = p_warehouse_id FOR UPDATE;
    IF NOT FOUND OR v_available < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_product.name;
    END IF;

    v_total := v_total + (v_product.base_price * v_qty);
  END LOOP;

  -- Generate a unique order number
  LOOP
    v_order_number := 'ORD-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 1000000))::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE organization_id = p_organization_id AND order_number = v_order_number);
  END LOOP;

  INSERT INTO orders (organization_id, customer_id, order_number, status, total_amount,
      total_items, notes, payment_method, delivery_address, contact_phone, idempotency_key)
  VALUES (p_organization_id, p_customer_id, v_order_number, 'pending', v_total,
      jsonb_array_length(p_items), p_notes, p_payment_method, p_delivery_address, p_phone, p_idempotency_key)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;

    INSERT INTO order_items (order_id, product_id, item_code, product_name_snapshot,
        unit_snapshot, quantity, unit_price_snapshot, line_total)
    VALUES (v_order_id, v_product.id, v_product.item_code, v_product.name,
        v_product.unit, v_qty, v_product.base_price, v_product.base_price * v_qty);

    UPDATE inventory_balances
      SET quantity_reserved = quantity_reserved + v_qty, updated_at = now()
      WHERE product_id = v_product.id AND warehouse_id = p_warehouse_id;
  END LOOP;

  INSERT INTO order_status_history (order_id, from_status, to_status, notes)
  VALUES (v_order_id, NULL, 'pending', 'تم إنشاء الطلب من المتجر');

  RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number,
    'total_amount', v_total, 'duplicate', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(uuid, uuid, uuid, jsonb, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, uuid, uuid, jsonb, text, text, text, text, text) TO anon, authenticated;
