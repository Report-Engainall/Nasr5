/*
# Simplify record_payment idempotency branch

1. Purpose
Removes a dead variable assignment in the duplicate-check branch of `record_payment`
that used an unnecessary `row_to_json` cast. Behavior is unchanged: the same idempotency
key returns `{ payment_id, duplicate: true }` without posting twice.

2. Modified Functions
- `record_payment`: identical logic, cleaner duplicate return path.

3. Security
- Grants unchanged (EXECUTE for anon + authenticated, revoked from PUBLIC).
*/

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
      RETURN jsonb_build_object('payment_id', v_existing, 'duplicate', true);
    END IF;
  END IF;

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

  IF v_party_balance <= 0 THEN
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
