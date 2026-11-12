-- orders has no shop_id; resolve shop from order_items.vendor_id.
CREATE OR REPLACE FUNCTION public.easyship_credit_shipping_from_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_shop_id uuid;
  v_amount numeric(14, 2);
  v_currency text;
  v_key text;
  v_meta jsonb;
  v_easyship jsonb;
  v_existing uuid;
BEGIN
  SELECT o.id, o.shipping_amount, o.currency, o.order_metadata, o.order_status
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  SELECT oi.vendor_id
  INTO v_shop_id
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.vendor_id IS NOT NULL
  ORDER BY oi.created_at NULLS LAST, oi.id
  LIMIT 1;

  IF v_shop_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shop_not_found');
  END IF;

  v_key := 'credit_from_order:' || p_order_id::text;
  SELECT id INTO v_existing
  FROM public.easyship_shipping_credit_ledger
  WHERE idempotency_key = v_key;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'ledger_id', v_existing);
  END IF;

  v_meta := coalesce(v_order.order_metadata, '{}'::jsonb);
  v_easyship := v_meta->'easyship';
  v_amount := coalesce(
    nullif((v_easyship->>'shipment_charge')::numeric, 0),
    nullif((v_easyship->>'shipping_amount')::numeric, 0),
    nullif((v_meta->'shipping_info'->>'shipment_charge')::numeric, 0),
    nullif((v_order.shipping_amount)::numeric, 0),
    0
  );
  v_currency := upper(coalesce(
    nullif(trim(v_easyship->>'currency'), ''),
    nullif(trim(v_order.currency), ''),
    'INR'
  ));

  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'zero_shipping');
  END IF;

  INSERT INTO public.easyship_shipping_credits (shop_id, balance_amount, currency, updated_at)
  VALUES (v_shop_id, v_amount, v_currency, now())
  ON CONFLICT (shop_id) DO UPDATE
  SET
    balance_amount = public.easyship_shipping_credits.balance_amount + EXCLUDED.balance_amount,
    currency = EXCLUDED.currency,
    updated_at = now();

  INSERT INTO public.easyship_shipping_credit_ledger (
    shop_id, order_id, entry_type, amount, currency, idempotency_key, payload
  ) VALUES (
    v_shop_id,
    p_order_id,
    'credit_from_order',
    v_amount,
    v_currency,
    v_key,
    jsonb_build_object(
      'order_status', v_order.order_status,
      'easyship', v_easyship,
      'shipping_amount', v_order.shipping_amount
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'shop_id', v_shop_id,
    'amount', v_amount,
    'currency', v_currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.easyship_credit_shipping_from_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.easyship_credit_shipping_from_order(uuid) TO service_role;
