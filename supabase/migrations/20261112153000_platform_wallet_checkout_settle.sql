-- Settle checkout from the buyer's platform wallet (full or partial vs PayU remainder).

CREATE OR REPLACE FUNCTION public.platform_wallet_settle_checkout(
  p_checkout_group_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_group public.commerce_checkout_groups%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_amount numeric(14, 2);
  v_apply numeric(14, 2);
  v_remaining numeric(14, 2);
  v_debit jsonb;
  v_step record;
  v_key text;
  v_order_ids uuid[];
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  IF p_checkout_group_id IS NOT NULL THEN
    SELECT * INTO v_group
    FROM public.commerce_checkout_groups
    WHERE id = p_checkout_group_id AND buyer_id = v_user;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'checkout_not_found');
    END IF;
    v_order_ids := coalesce(v_group.order_ids, ARRAY[]::uuid[]);
    v_amount := round(
      coalesce(p_amount, v_group.total_amount, 0)::numeric,
      2
    );
  ELSIF p_order_id IS NOT NULL THEN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND OR v_order.user_id <> v_user THEN
      RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
    END IF;
    v_order_ids := ARRAY[v_order.id];
    v_amount := round(
      coalesce(p_amount, v_order.customer_total_amount, v_order.total_amount, 0)::numeric,
      2
    );
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'checkout_required');
  END IF;

  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  v_key := 'checkout_settle:'
    || coalesce(p_checkout_group_id::text, p_order_id::text)
    || ':'
    || v_amount::text;

  v_debit := public.platform_wallet_debit(
    'user',
    v_user,
    v_amount,
    'spend_checkout',
    v_key,
    coalesce(v_group.currency, v_order.currency, 'INR'),
    'Checkout wallet payment',
    jsonb_build_object(
      'order_id', p_order_id,
      'checkout_group_id', p_checkout_group_id,
      'order_ids', to_jsonb(v_order_ids)
    ),
    coalesce(p_order_id, v_order_ids[1]),
    NULL,
    NULL
  );

  IF coalesce((v_debit->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_debit;
  END IF;

  v_remaining := v_amount;

  IF p_checkout_group_id IS NOT NULL THEN
    FOR v_step IN
      SELECT id, amount, status
      FROM public.commerce_checkout_payment_steps
      WHERE checkout_group_id = p_checkout_group_id
        AND lower(coalesce(status, '')) IN ('pending', 'processing', 'requires_action', 'created')
      ORDER BY created_at ASC
    LOOP
      IF v_remaining <= 0 THEN
        EXIT;
      END IF;
      v_apply := least(coalesce(v_step.amount, 0), v_remaining);
      IF coalesce(v_step.amount, 0) - v_apply <= 0.009 THEN
        UPDATE public.commerce_checkout_payment_steps
        SET
          status = 'completed',
          amount = 0,
          processed_at = coalesce(processed_at, now()),
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'wallet_settled', true,
            'wallet_amount', v_apply
          ),
          updated_at = now()
        WHERE id = v_step.id;
      ELSE
        UPDATE public.commerce_checkout_payment_steps
        SET
          amount = amount - v_apply,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'wallet_partial', true,
            'wallet_amount', v_apply
          ),
          updated_at = now()
        WHERE id = v_step.id;
      END IF;
      v_remaining := v_remaining - v_apply;
    END LOOP;

    IF NOT EXISTS (
      SELECT 1
      FROM public.commerce_checkout_payment_steps s
      WHERE s.checkout_group_id = p_checkout_group_id
        AND coalesce(s.amount, 0) > 0.009
        AND lower(coalesce(s.status, '')) IN ('pending', 'processing', 'requires_action', 'created')
    ) THEN
      UPDATE public.orders
      SET
        order_status = CASE
          WHEN lower(coalesce(order_status, '')) IN (
            'pending', 'awaiting_payment', 'created', 'draft', 'payment_pending'
          ) THEN 'paid'
          ELSE order_status
        END,
        updated_at = now()
      WHERE id = ANY (v_order_ids)
        AND user_id = v_user;

      UPDATE public.commerce_checkout_groups
      SET
        status = 'paid',
        paid_at = coalesce(paid_at, now()),
        updated_at = now()
      WHERE id = p_checkout_group_id
        AND buyer_id = v_user;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'debit', v_debit,
    'applied', v_amount,
    'checkout_group_id', p_checkout_group_id,
    'order_ids', to_jsonb(v_order_ids),
    'fully_settled', v_remaining <= 0.009 AND p_checkout_group_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.commerce_checkout_payment_steps s
        WHERE s.checkout_group_id = p_checkout_group_id
          AND coalesce(s.amount, 0) > 0.009
          AND lower(coalesce(s.status, '')) IN ('pending', 'processing', 'requires_action', 'created')
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_wallet_settle_checkout(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_wallet_settle_checkout(uuid, uuid, numeric) TO authenticated, service_role;
