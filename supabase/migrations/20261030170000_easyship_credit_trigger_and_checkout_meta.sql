-- Fix Easyship credit RPC/trigger (orders have order_status, not payment_status).
-- Persist DDP quote on order_metadata.easyship at checkout.
-- Auto-credit when order_payments become completed (all gateways).

CREATE OR REPLACE FUNCTION public.easyship_credit_shipping_from_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_amount numeric(14, 2);
  v_currency text;
  v_key text;
  v_meta jsonb;
  v_easyship jsonb;
  v_existing uuid;
BEGIN
  SELECT o.id, o.shop_id, o.shipping_amount, o.currency, o.order_metadata, o.order_status
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
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
  VALUES (v_order.shop_id, v_amount, v_currency, now())
  ON CONFLICT (shop_id) DO UPDATE
  SET
    balance_amount = public.easyship_shipping_credits.balance_amount + EXCLUDED.balance_amount,
    currency = EXCLUDED.currency,
    updated_at = now();

  INSERT INTO public.easyship_shipping_credit_ledger (
    shop_id, order_id, entry_type, amount, currency, idempotency_key, payload
  ) VALUES (
    v_order.shop_id,
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
    'shop_id', v_order.shop_id,
    'amount', v_amount,
    'currency', v_currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.easyship_credit_shipping_from_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.easyship_credit_shipping_from_order(uuid) TO service_role;

-- Auto-credit when payment completes (Airwallex / PayU / Razorpay / COD collected).
CREATE OR REPLACE FUNCTION public.trg_easyship_credit_on_payment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status IS DISTINCT FROM 'completed'::payment_status_enum THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.payment_status IS NOT DISTINCT FROM 'completed'::payment_status_enum THEN
    RETURN NEW;
  END IF;
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.easyship_credit_shipping_from_order(NEW.order_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'easyship_credit_shipping_from_order failed for payment % order %: %',
    NEW.id, NEW.order_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_easyship_credit_on_payment_completed ON public.order_payments;
CREATE TRIGGER trg_easyship_credit_on_payment_completed
  AFTER INSERT OR UPDATE OF payment_status ON public.order_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_easyship_credit_on_payment_completed();

-- Also credit when order leaves awaiting_payment (covers paths that skip order_payments update timing).
CREATE OR REPLACE FUNCTION public.trg_easyship_credit_on_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_status IS NOT DISTINCT FROM OLD.order_status THEN
    RETURN NEW;
  END IF;
  IF OLD.order_status IS DISTINCT FROM 'awaiting_payment'::order_status_enum THEN
    RETURN NEW;
  END IF;
  IF NEW.order_status IN (
    'cancelled'::order_status_enum,
    'refunded'::order_status_enum
  ) THEN
    RETURN NEW;
  END IF;
  PERFORM public.easyship_credit_shipping_from_order(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'easyship_credit_shipping_from_order failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_easyship_credit_on_order_paid ON public.orders;
CREATE TRIGGER trg_easyship_credit_on_order_paid
  AFTER UPDATE OF order_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_easyship_credit_on_order_paid();

CREATE OR REPLACE FUNCTION public.notify_easyship_shipping_credit_low()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_shop_name text;
  v_threshold numeric := 100;
  v_prev numeric;
BEGIN
  IF NEW.balance_amount IS NULL THEN
    RETURN NEW;
  END IF;

  v_prev := COALESCE(OLD.balance_amount, NEW.balance_amount + 1);
  IF NOT (
    NEW.balance_amount <= v_threshold
    AND (TG_OP = 'INSERT' OR v_prev > v_threshold)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id, s.shop_name
  INTO v_owner, v_shop_name
  FROM public.shops s
  WHERE s.id = NEW.shop_id;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification_idempotent(
    'easyship_shipping_credit_low_seller',
    v_owner,
    'easyship_credit_low:' || NEW.shop_id::text || ':' || to_char(timezone('utc', now()), 'YYYY-MM-DD'),
    jsonb_build_object(
      'balance', to_char(NEW.balance_amount, 'FM999999990.00'),
      'currency', COALESCE(NEW.currency, 'INR'),
      'shop_name', COALESCE(v_shop_name, 'Your shop')
    ),
    'shop',
    NEW.shop_id,
    NULL,
    NULL,
    4,
    NULL,
    'easyship_shipping_credit_trigger'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_easyship_shipping_credit_low ON public.easyship_shipping_credits;
CREATE TRIGGER trg_notify_easyship_shipping_credit_low
  AFTER INSERT OR UPDATE OF balance_amount ON public.easyship_shipping_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_easyship_shipping_credit_low();

INSERT INTO public.notification_templates (
  template_key,
  category,
  platform,
  title_template,
  message_template,
  action_url_template,
  default_channels,
  default_priority,
  is_active
)
VALUES (
  'easyship_shipping_credit_low_seller',
  'transactional',
  'marketplace',
  'Shipping credit running low',
  'Your Easyship shipping credit is {{balance}} {{currency}}. Recharge under Vendor → Shipping credit before processing more shipments.',
  '/vendor/wallet',
  ARRAY['in_app', 'push', 'email']::text[],
  4,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  message_template = EXCLUDED.message_template,
  action_url_template = EXCLUDED.action_url_template,
  is_active = true,
  updated_at = now();

-- Persist full Easyship DDP snapshot on order create.
CREATE OR REPLACE FUNCTION public.atomic_marketplace_checkout(
  p_cart_id uuid,
  p_cart_item_ids uuid[],
  p_shipping_address_id uuid,
  p_billing_address_id uuid DEFAULT NULL,
  p_payment_mode text DEFAULT 'online',
  p_idempotency_key text DEFAULT NULL,
  p_notes_by_shop jsonb DEFAULT '{}'::jsonb,
  p_gift_shop_ids uuid[] DEFAULT ARRAY[]::uuid[]
,
  p_customer_currency text DEFAULT NULL,
  p_customer_amounts_by_shop jsonb DEFAULT '{}'::jsonb,
  p_easyship_by_shop jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cart public.carts%ROWTYPE;
  v_group public.commerce_checkout_groups%ROWTYPE;
  v_existing public.commerce_checkout_groups%ROWTYPE;
  v_discount public.discount_profiles%ROWTYPE;
  v_shop record;
  v_order_result jsonb;
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_order_numbers text[] := ARRAY[]::text[];
  v_items jsonb;
  v_subtotal numeric := 0;
  v_eligible_subtotal numeric := 0;
  v_discount_total numeric := 0;
  v_shipping_total numeric := 0;
  v_shop_subtotal numeric;
  v_shop_discount numeric;
  v_shop_shipping numeric;
  v_shop_total numeric;
  v_shop_subtotal_after_discount numeric;
  v_shipping_quote jsonb;
  v_requires_shipping boolean;
  v_collection text;
  v_provider text;
  v_line_count integer;
  v_customer_discount_uses integer := 0;
  v_customer_country text := 'IN';
  v_customer_currency text;
  v_estimated_delivery date;
  v_payment_provider text;
  v_shop_currency text;
  v_customer_subtotal numeric;
  v_customer_shipping numeric;
  v_customer_discount numeric;
  v_customer_total numeric;
  v_customer_amounts jsonb;
  v_conversion_applied boolean;
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_buyer_type text;
  v_free_shipping boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_key IS NULL OR char_length(v_key) < 8 THEN
    RAISE EXCEPTION 'A valid idempotency key is required';
  END IF;
  IF p_payment_mode NOT IN ('online', 'cod') THEN
    RAISE EXCEPTION 'Unsupported payment mode';
  END IF;
  IF coalesce(array_length(p_cart_item_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one cart item';
  END IF;

  SELECT * INTO v_existing
  FROM public.commerce_checkout_groups
  WHERE buyer_id = v_user_id AND idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'checkout_group_id', v_existing.id,
      'status', v_existing.status,
      'order_ids', v_existing.order_ids,
      'order_numbers', (
        SELECT coalesce(array_agg(o.order_number ORDER BY o.created_at), ARRAY[]::text[])
        FROM public.orders o WHERE o.id = ANY(v_existing.order_ids)
      ),
      'subtotal_amount', v_existing.subtotal_amount,
      'discount_amount', v_existing.discount_amount,
      'total_amount', v_existing.total_amount,
      'payment_steps', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', ps.id, 'order_id', ps.order_id, 'shop_id', ps.shop_id,
          'collection', ps.collection, 'provider', ps.provider,
          'status', ps.status, 'amount', ps.amount, 'checkout_url', ps.checkout_url
        ) ORDER BY ps.created_at), '[]'::jsonb)
        FROM public.commerce_checkout_payment_steps ps
        WHERE ps.checkout_group_id = v_existing.id
      ),
      'idempotent_replay', true
    );
  END IF;

  SELECT * INTO v_cart FROM public.carts WHERE id = p_cart_id FOR UPDATE;
  IF NOT FOUND OR v_cart.user_id IS DISTINCT FROM v_user_id OR v_cart.status <> 'active' THEN
    RAISE EXCEPTION 'Cart not found or unavailable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.addresses
    WHERE id = p_shipping_address_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Shipping address not found';
  END IF;
  IF p_billing_address_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.addresses
    WHERE id = p_billing_address_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Billing address not found';
  END IF;

  SELECT public.normalize_iso_country_code(a.country)
  INTO v_customer_country
  FROM public.addresses a
  WHERE a.id = p_shipping_address_id;

  v_customer_currency := coalesce(nullif(trim(p_customer_currency), ''), v_cart.currency, 'INR');
  v_payment_provider := CASE WHEN p_payment_mode = 'cod' THEN 'cod' ELSE 'online' END;

  SELECT count(*) INTO v_line_count
  FROM public.cart_items ci
  WHERE ci.cart_id = p_cart_id
    AND ci.id = ANY(p_cart_item_ids)
    AND ci.saved_for_later = false;
  IF v_line_count <> cardinality(p_cart_item_ids) THEN
    RAISE EXCEPTION 'One or more selected cart items are invalid';
  END IF;

  PERFORM l.id
  FROM public.listings l
  JOIN public.cart_items ci ON ci.listing_id = l.id
  WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids) AND ci.saved_for_later = false
  ORDER BY l.id
  FOR UPDATE OF l;

  PERFORM lv.id
  FROM public.listing_variations lv
  JOIN public.cart_items ci ON ci.variant_id = lv.id
  WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids) AND ci.saved_for_later = false
  ORDER BY lv.id
  FOR UPDATE OF lv;

  IF public.commerce_cart_items_unavailable(p_cart_id, p_cart_item_ids) THEN
    RAISE EXCEPTION 'One or more items are unavailable or out of stock';
  END IF;

  SELECT coalesce(sum(public.commerce_cart_line_unit_price(ci.item_metadata, ci.unit_price, l.price, lv.price_adjustment) * ci.quantity), 0)
  INTO v_subtotal
  FROM public.cart_items ci
  JOIN public.listings l ON l.id = ci.listing_id
  LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
  WHERE ci.cart_id = p_cart_id
    AND ci.id = ANY(p_cart_item_ids)
    AND ci.saved_for_later = false;

  IF v_cart.applied_discount_id IS NOT NULL THEN
    SELECT * INTO v_discount
    FROM public.discount_profiles
    WHERE id = v_cart.applied_discount_id
    FOR UPDATE;

    IF NOT FOUND OR NOT v_discount.is_active
       OR v_discount.valid_from > now()
       OR (v_discount.valid_until IS NOT NULL AND v_discount.valid_until < now())
       OR (v_discount.max_uses_total IS NOT NULL AND v_discount.max_uses_total > 0
           AND coalesce(v_discount.total_uses, 0) >= v_discount.max_uses_total) THEN
      RAISE EXCEPTION 'The applied coupon is no longer valid';
    END IF;

    SELECT count(*) INTO v_customer_discount_uses
    FROM public.orders o
    WHERE o.user_id = v_user_id
      AND o.order_metadata->'discount_info'->>'discount_profile_id' = v_discount.id::text
      AND o.order_status NOT IN ('cancelled', 'refunded');
    IF v_discount.max_uses_per_customer IS NOT NULL
       AND v_discount.max_uses_per_customer > 0
       AND v_customer_discount_uses >= v_discount.max_uses_per_customer THEN
      RAISE EXCEPTION 'You have already used this coupon';
    END IF;

    SELECT coalesce(sum(public.commerce_cart_line_unit_price(ci.item_metadata, ci.unit_price, l.price, lv.price_adjustment) * ci.quantity), 0)
    INTO v_eligible_subtotal
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND ci.saved_for_later = false
      AND (v_discount.shop_id IS NULL OR l.shop_id = v_discount.shop_id)
      AND (v_discount.eligible_listings IS NULL OR l.id = ANY(v_discount.eligible_listings));

    v_buyer_type := public.commerce_discount_buyer_user_type(v_user_id);
    IF NOT public.commerce_discount_user_type_ok(v_discount.eligible_user_types, v_buyer_type) THEN
      RAISE EXCEPTION 'This coupon is not available for your account';
    END IF;
    IF v_discount.discount_code IS NULL
       AND NOT public.commerce_discount_is_assigned(v_discount.id, v_user_id) THEN
      RAISE EXCEPTION 'The applied coupon is no longer valid';
    END IF;

    IF v_eligible_subtotal < coalesce(v_discount.min_order_amount, 0)
       AND v_discount.discount_type <> 'bogo' THEN
      RAISE EXCEPTION 'The selected items no longer meet the coupon minimum';
    END IF;
    v_free_shipping := v_discount.discount_type = 'free_shipping';
    IF v_discount.discount_type = 'bogo' THEN
      v_discount_total := public.commerce_cart_bogo_discount(p_cart_id, p_cart_item_ids, v_discount.id);
      IF v_eligible_subtotal <= 0 THEN
        v_eligible_subtotal := v_subtotal;
      END IF;
    ELSIF v_discount.discount_type = 'free_shipping' THEN
      v_discount_total := 0;
      IF v_eligible_subtotal <= 0 THEN
        v_eligible_subtotal := v_subtotal;
      END IF;
    ELSIF v_discount.discount_type = 'percentage' THEN
      v_discount_total := round(v_eligible_subtotal * v_discount.discount_value / 100, 2);
    ELSE
      v_discount_total := v_discount.discount_value;
    END IF;
    IF v_discount.max_discount_amount IS NOT NULL THEN
      v_discount_total := least(v_discount_total, v_discount.max_discount_amount);
    END IF;
    IF v_discount.discount_type <> 'bogo' AND v_discount.discount_type <> 'free_shipping' THEN
      v_discount_total := greatest(0, least(v_discount_total, v_eligible_subtotal));
    ELSE
      v_discount_total := greatest(0, least(v_discount_total, v_subtotal));
    END IF;
  END IF;

  INSERT INTO public.commerce_checkout_groups (
    buyer_id, cart_id, idempotency_key, status, payment_mode, currency,
    subtotal_amount, discount_amount, total_amount, selected_cart_item_ids
  ) VALUES (
    v_user_id, p_cart_id, v_key, 'created', p_payment_mode, v_customer_currency,
    v_subtotal, v_discount_total, greatest(0, v_subtotal - v_discount_total), p_cart_item_ids
  )
  RETURNING * INTO v_group;

  FOR v_shop IN
    SELECT l.shop_id, s.shop_name, s.shop_currency,
      coalesce(scs.payment_mode, 'shepay') AS routing_mode,
      scs.payment_gateway,
      sum(public.commerce_cart_line_unit_price(ci.item_metadata, ci.unit_price, l.price, lv.price_adjustment) * ci.quantity) AS subtotal
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    JOIN public.shops s ON s.id = l.shop_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    LEFT JOIN public.shop_commerce_settings scs ON scs.shop_id = l.shop_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND ci.saved_for_later = false
    GROUP BY l.shop_id, s.shop_name, s.shop_currency, scs.payment_mode, scs.payment_gateway
    ORDER BY l.shop_id
  LOOP
    v_shop_subtotal := v_shop.subtotal;
    v_shop_discount := CASE
      WHEN v_eligible_subtotal > 0 THEN round(v_discount_total * (
        SELECT coalesce(sum(public.commerce_cart_line_unit_price(ci.item_metadata, ci.unit_price, l.price, lv.price_adjustment) * ci.quantity), 0)
        FROM public.cart_items ci
        JOIN public.listings l ON l.id = ci.listing_id
        LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
        WHERE ci.cart_id = p_cart_id
          AND ci.id = ANY(p_cart_item_ids)
          AND ci.saved_for_later = false
          AND l.shop_id = v_shop.shop_id
          AND (v_discount.shop_id IS NULL OR l.shop_id = v_discount.shop_id)
          AND (v_discount.eligible_listings IS NULL OR l.id = ANY(v_discount.eligible_listings))
      ) / v_eligible_subtotal, 2)
      ELSE 0
    END;

    v_shop_subtotal_after_discount := greatest(0, v_shop_subtotal - v_shop_discount);

    SELECT EXISTS (
      SELECT 1
      FROM public.cart_items ci
      JOIN public.listings l ON l.id = ci.listing_id
      WHERE ci.cart_id = p_cart_id
        AND ci.id = ANY(p_cart_item_ids)
        AND ci.saved_for_later = false
        AND l.shop_id = v_shop.shop_id
        AND l.listing_type IS DISTINCT FROM 'digital'
        AND coalesce(l.shipping_required, true)
    ) INTO v_requires_shipping;

    IF p_easyship_by_shop ? v_shop.shop_id::text THEN
      v_shipping_quote := p_easyship_by_shop->v_shop.shop_id::text;
      v_shop_shipping := coalesce((v_shipping_quote->>'shipment_charge')::numeric, (v_shipping_quote->>'shipping_amount')::numeric, 0);
      -- tax/duty/handling applied via tax_amount on the order; include in shop total
      v_shop_shipping := v_shop_shipping
        + coalesce((v_shipping_quote->>'tax_amount')::numeric, 0)
        + coalesce((v_shipping_quote->>'duty_amount')::numeric, 0)
        + coalesce((v_shipping_quote->>'handling_fee')::numeric, 0);
      v_estimated_delivery := current_date + coalesce((v_shipping_quote->>'estimated_days')::integer, 7);
    ELSE
      v_shipping_quote := public.calculate_shop_shipping_from_profiles(
        v_shop.shop_id,
        v_shop_subtotal_after_discount,
        v_requires_shipping
      );
      v_shop_shipping := coalesce((v_shipping_quote->>'shipping_amount')::numeric, 0);
      v_estimated_delivery := current_date + coalesce((v_shipping_quote->>'processing_time_max')::integer, 7);
    END IF;
    IF v_free_shipping THEN
      v_shop_shipping := 0;
    END IF;
    v_shop_total := v_shop_subtotal_after_discount + v_shop_shipping;
    v_shipping_total := v_shipping_total + v_shop_shipping;

    SELECT jsonb_agg(jsonb_build_object(
      'listing_id', l.id,
      'quantity', ci.quantity,
      'unit_price', l.price + coalesce(lv.price_adjustment, 0),
      'variation_details', CASE WHEN ci.variant_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
        'variant_id', ci.variant_id,
        'variant_name', lv.variation_name,
        'variant_value', lv.variation_value
      ) END
    ) ORDER BY ci.id)
    INTO v_items
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND ci.saved_for_later = false
      AND l.shop_id = v_shop.shop_id;

    v_shop_currency := coalesce(nullif(trim(v_shop.shop_currency), ''), 'INR');
    v_customer_amounts := p_customer_amounts_by_shop->v_shop.shop_id::text;
    v_conversion_applied := v_customer_currency IS DISTINCT FROM v_shop_currency;

    IF v_conversion_applied
       AND v_customer_amounts IS NOT NULL
       AND v_customer_amounts <> 'null'::jsonb
       AND v_customer_amounts <> '{}'::jsonb THEN
      v_customer_subtotal := coalesce((v_customer_amounts->>'subtotal_amount')::numeric, v_shop_subtotal);
      v_customer_shipping := coalesce((v_customer_amounts->>'shipping_amount')::numeric, v_shop_shipping);
      v_customer_discount := coalesce((v_customer_amounts->>'discount_amount')::numeric, v_shop_discount);
      v_customer_total := coalesce((v_customer_amounts->>'total_amount')::numeric, v_shop_total);
    ELSE
      v_customer_subtotal := v_shop_subtotal;
      v_customer_shipping := v_shop_shipping;
      v_customer_discount := v_shop_discount;
      v_customer_total := v_shop_total;
    END IF;

    IF NOT public.shop_airwallex_kyc_allows_orders(v_shop.shop_id) THEN
      RAISE EXCEPTION 'This shop is not ready to accept orders yet. Payout verification is still pending.';
    END IF;

    v_order_result := public.create_customer_order(jsonb_build_object(
      'user_id', v_user_id,
      'cart_items', v_items,
      'shipping_address_id', p_shipping_address_id,
      'billing_address_id', coalesce(p_billing_address_id, p_shipping_address_id),
      'customer_notes', nullif(p_notes_by_shop->>v_shop.shop_id::text, ''),
      'payment_mode', p_payment_mode,
      'payment_provider', v_payment_provider,
      'currency', v_shop_currency,
      'customer_currency', v_customer_currency,
      'customer_country', v_customer_country,
      'subtotal_amount', v_shop_subtotal,
      'shipping_amount', v_shop_shipping,
      'tax_amount', 0,
      'discount_amount', v_shop_discount,
      'total_amount', v_shop_total,
      'customer_subtotal_amount', v_customer_subtotal,
      'customer_shipping_amount', v_customer_shipping,
      'customer_tax_amount', 0,
      'customer_discount_amount', v_customer_discount,
      'customer_total_amount', v_customer_total,
      'estimated_delivery_date', v_estimated_delivery,
      'discount_codes', CASE WHEN v_discount.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_discount.discount_code) END,
      'order_source', 'sheconomy-one',
      'order_metadata', jsonb_build_object(
        'created_via', 'atomic_marketplace_checkout',
        'checkout_group_id', v_group.id,
        'currency_info', jsonb_build_object(
          'shop_currency', v_shop_currency,
          'customer_currency', v_customer_currency,
          'customer_country', v_customer_country,
          'currency_conversion_applied', v_conversion_applied,
          'detected_at', now()
        ),
        'shipping_info', jsonb_build_object(
          'delivery_profile_id', v_shipping_quote->>'delivery_profile_id',
          'delivery_profile_name', v_shipping_quote->>'delivery_profile_name',
          'shipping_amount', v_shop_shipping,
          'is_free_shipping', coalesce((v_shipping_quote->>'is_free_shipping')::boolean, v_shop_shipping = 0),
          'processing_time_max', coalesce((v_shipping_quote->>'processing_time_max')::integer, 7),
          'estimated_delivery_date', v_estimated_delivery
        ),
        'easyship', CASE
          WHEN p_easyship_by_shop ? v_shop.shop_id::text THEN p_easyship_by_shop->v_shop.shop_id::text
          ELSE NULL
        END,
        'payment_info', jsonb_build_object(
          'provider', v_payment_provider,
          'initiated_at', now()
        ),
        'discount_info', CASE WHEN v_discount.id IS NULL THEN NULL ELSE jsonb_build_object(
          'discount_profile_id', v_discount.id,
          'discount_name', v_discount.discount_name,
          'total_discount', v_shop_discount
        ) END,
        'gift', jsonb_build_object('is_gift', v_shop.shop_id = ANY(p_gift_shop_ids))
      )
    ));

    IF coalesce(v_order_result->>'success', 'true') = 'false' THEN
      RAISE EXCEPTION '%', coalesce(v_order_result->>'message', 'Order creation failed');
    END IF;

    -- COD only: notify immediately (payment happens on delivery, order is confirmed now).
    -- Online payment (Razorpay / PayU): defer — notified after webhook confirms payment.
    IF p_payment_mode = 'cod' THEN
      PERFORM public.dispatch_marketplace_order_notifications((v_order_result->>'order_id')::uuid);
    END IF;

    v_order_ids := array_append(v_order_ids, (v_order_result->>'order_id')::uuid);
    v_order_numbers := array_append(v_order_numbers, v_order_result->>'order_number');
    v_collection := CASE
      WHEN p_payment_mode = 'cod' THEN 'cod'
      WHEN v_shop.routing_mode IN ('direct', 'seller_direct') THEN 'direct'
      ELSE 'shepay'
    END;
    v_provider := CASE WHEN v_collection = 'direct' THEN v_shop.payment_gateway ELSE 'shepay' END;

    INSERT INTO public.commerce_checkout_payment_steps (
      checkout_group_id, order_id, shop_id, collection, provider, status,
      amount, currency, idempotency_key, metadata
    ) VALUES (
      v_group.id, (v_order_result->>'order_id')::uuid, v_shop.shop_id,
      v_collection, v_provider,
      CASE WHEN p_payment_mode = 'cod' THEN 'processing' ELSE 'pending' END,
      v_shop_total, v_shop_currency,
      v_key || ':' || v_shop.shop_id::text,
      jsonb_build_object(
        'order_number', v_order_result->>'order_number',
        'platform_fee_amount', 0,
        'commission_applies', false,
        'shipping_amount', v_shop_shipping
      )
    );
  END LOOP;

  INSERT INTO public.inventory_reservations (
    checkout_group_id, listing_id, variation_id, quantity, status,
    expires_at, converted_at
  )
  SELECT v_group.id, x.listing_id, x.variant_id, sum(x.qty),
    CASE WHEN p_payment_mode = 'cod' THEN 'converted' ELSE 'reserved' END,
    v_group.expires_at, CASE WHEN p_payment_mode = 'cod' THEN now() ELSE NULL END
  FROM (
    SELECT ci.listing_id, ci.variant_id, ci.quantity AS qty
    FROM public.cart_items ci
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND ci.saved_for_later = false
      AND coalesce(ci.item_metadata->>'bundle_id','') = ''
    UNION ALL
    SELECT (child->>'listing_id')::uuid, NULL::uuid,
      ci.quantity * coalesce((child->>'quantity')::integer, 1)
    FROM public.cart_items ci
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(ci.item_metadata->'bundle_items','[]'::jsonb)) child
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND ci.saved_for_later = false
      AND coalesce(ci.item_metadata->>'bundle_id','') <> ''
  ) x
  GROUP BY x.listing_id, x.variant_id;

  IF v_discount.id IS NOT NULL AND v_discount_total > 0 THEN
    UPDATE public.discount_profiles
    SET total_uses = coalesce(total_uses, 0) + 1, updated_at = now()
    WHERE id = v_discount.id;
  END IF;

  DELETE FROM public.cart_items
  WHERE cart_id = p_cart_id
    AND id = ANY(p_cart_item_ids)
    AND saved_for_later = false;

  PERFORM public.update_cart_totals(p_cart_id);

  UPDATE public.commerce_checkout_groups
  SET order_ids = v_order_ids,
      total_amount = greatest(0, v_subtotal - v_discount_total + v_shipping_total),
      status = CASE WHEN p_payment_mode = 'cod' THEN 'paid' ELSE 'awaiting_payment' END,
      paid_at = CASE WHEN p_payment_mode = 'cod' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = v_group.id
  RETURNING * INTO v_group;

  RETURN jsonb_build_object(
    'success', true,
    'checkout_group_id', v_group.id,
    'status', v_group.status,
    'order_ids', v_order_ids,
    'order_numbers', v_order_numbers,
    'subtotal_amount', v_subtotal,
    'discount_amount', v_discount_total,
    'shipping_amount', v_shipping_total,
    'platform_fee_amount', 0,
    'total_amount', greatest(0, v_subtotal - v_discount_total + v_shipping_total),
    'payment_steps', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', ps.id,
        'order_id', ps.order_id,
        'shop_id', ps.shop_id,
        'collection', ps.collection,
        'provider', ps.provider,
        'status', ps.status,
        'amount', ps.amount,
        'checkout_url', ps.checkout_url
      ) ORDER BY ps.created_at), '[]'::jsonb)
      FROM public.commerce_checkout_payment_steps ps
      WHERE ps.checkout_group_id = v_group.id
    )
  );
END;
$$;
