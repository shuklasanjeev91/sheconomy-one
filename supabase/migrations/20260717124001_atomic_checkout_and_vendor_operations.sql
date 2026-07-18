-- Marketplace phases 2/3: atomic multi-shop checkout, resumable payment
-- groups, and secure seller-operation mutations.

CREATE TABLE IF NOT EXISTS public.commerce_checkout_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'awaiting_payment', 'partially_paid', 'paid', 'failed', 'cancelled', 'expired')),
  payment_mode text NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  subtotal_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  order_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  selected_cart_item_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  last_error text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.commerce_checkout_payment_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_group_id uuid NOT NULL REFERENCES public.commerce_checkout_groups(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  collection text NOT NULL CHECK (collection IN ('direct', 'shepay', 'cod')),
  provider text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'requires_action', 'processing', 'paid', 'failed', 'cancelled', 'expired')),
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'INR',
  attempt_count integer NOT NULL DEFAULT 0,
  provider_reference text,
  checkout_url text,
  idempotency_key text NOT NULL,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkout_group_id, shop_id),
  UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_group_id uuid NOT NULL REFERENCES public.commerce_checkout_groups(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.listing_variations(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'converted'
    CHECK (status IN ('reserved', 'converted', 'released', 'expired')),
  expires_at timestamptz NOT NULL,
  converted_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkout_group_id, listing_id, variation_id)
);

CREATE INDEX IF NOT EXISTS commerce_checkout_groups_buyer_created_idx
  ON public.commerce_checkout_groups (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_checkout_steps_group_idx
  ON public.commerce_checkout_payment_steps (checkout_group_id, created_at);
CREATE INDEX IF NOT EXISTS inventory_reservations_listing_idx
  ON public.inventory_reservations (listing_id, status, expires_at);

ALTER TABLE public.commerce_checkout_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_checkout_payment_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_groups_buyer_select ON public.commerce_checkout_groups;
CREATE POLICY checkout_groups_buyer_select
  ON public.commerce_checkout_groups FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS checkout_steps_participant_select ON public.commerce_checkout_payment_steps;
CREATE POLICY checkout_steps_participant_select
  ON public.commerce_checkout_payment_steps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.commerce_checkout_groups cg
      WHERE cg.id = checkout_group_id AND cg.buyer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reservations_buyer_select ON public.inventory_reservations;
CREATE POLICY reservations_buyer_select
  ON public.inventory_reservations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commerce_checkout_groups cg
      WHERE cg.id = checkout_group_id AND cg.buyer_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.atomic_marketplace_checkout(
  p_cart_id uuid,
  p_cart_item_ids uuid[],
  p_shipping_address_id uuid,
  p_billing_address_id uuid DEFAULT NULL,
  p_payment_mode text DEFAULT 'online',
  p_idempotency_key text DEFAULT NULL,
  p_notes_by_shop jsonb DEFAULT '{}'::jsonb,
  p_gift_shop_ids uuid[] DEFAULT ARRAY[]::uuid[]
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
  v_shop_subtotal numeric;
  v_shop_discount numeric;
  v_shop_total numeric;
  v_collection text;
  v_provider text;
  v_line_count integer;
  v_customer_discount_uses integer := 0;
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
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

  SELECT count(*) INTO v_line_count
  FROM public.cart_items ci
  WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids);
  IF v_line_count <> cardinality(p_cart_item_ids) THEN
    RAISE EXCEPTION 'One or more selected cart items are invalid';
  END IF;

  -- Serialize all selected inventory before validating or calculating prices.
  PERFORM l.id
  FROM public.listings l
  JOIN public.cart_items ci ON ci.listing_id = l.id
  WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids)
  ORDER BY l.id
  FOR UPDATE OF l;

  PERFORM lv.id
  FROM public.listing_variations lv
  JOIN public.cart_items ci ON ci.variant_id = lv.id
  WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids)
  ORDER BY lv.id
  FOR UPDATE OF lv;

  IF EXISTS (
    SELECT 1
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND (
        NOT l.is_active OR l.listing_status <> 'active'
        OR (l.quantity IS NOT NULL AND l.quantity < ci.quantity)
        OR (ci.variant_id IS NOT NULL AND (NOT coalesce(lv.is_available, false) OR (lv.stock IS NOT NULL AND lv.stock < ci.quantity)))
      )
  ) THEN
    RAISE EXCEPTION 'One or more items are unavailable or out of stock';
  END IF;

  SELECT coalesce(sum((l.price + coalesce(lv.price_adjustment, 0)) * ci.quantity), 0)
  INTO v_subtotal
  FROM public.cart_items ci
  JOIN public.listings l ON l.id = ci.listing_id
  LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
  WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids);

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

    SELECT coalesce(sum((l.price + coalesce(lv.price_adjustment, 0)) * ci.quantity), 0)
    INTO v_eligible_subtotal
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    WHERE ci.cart_id = p_cart_id
      AND ci.id = ANY(p_cart_item_ids)
      AND (v_discount.shop_id IS NULL OR l.shop_id = v_discount.shop_id)
      AND (v_discount.eligible_listings IS NULL OR l.id = ANY(v_discount.eligible_listings));

    IF v_eligible_subtotal < coalesce(v_discount.min_order_amount, 0) THEN
      RAISE EXCEPTION 'The selected items no longer meet the coupon minimum';
    END IF;
    IF v_discount.discount_type = 'percentage' THEN
      v_discount_total := round(v_eligible_subtotal * v_discount.discount_value / 100, 2);
    ELSE
      v_discount_total := v_discount.discount_value;
    END IF;
    IF v_discount.max_discount_amount IS NOT NULL THEN
      v_discount_total := least(v_discount_total, v_discount.max_discount_amount);
    END IF;
    v_discount_total := greatest(0, least(v_discount_total, v_eligible_subtotal));
  END IF;

  INSERT INTO public.commerce_checkout_groups (
    buyer_id, cart_id, idempotency_key, status, payment_mode, currency,
    subtotal_amount, discount_amount, total_amount, selected_cart_item_ids
  ) VALUES (
    v_user_id, p_cart_id, v_key, 'created', p_payment_mode, v_cart.currency,
    v_subtotal, v_discount_total, greatest(0, v_subtotal - v_discount_total), p_cart_item_ids
  )
  RETURNING * INTO v_group;

  FOR v_shop IN
    SELECT l.shop_id, s.shop_name,
      coalesce(scs.payment_mode, 'shepay') AS routing_mode,
      scs.payment_gateway,
      sum((l.price + coalesce(lv.price_adjustment, 0)) * ci.quantity) AS subtotal
    FROM public.cart_items ci
    JOIN public.listings l ON l.id = ci.listing_id
    JOIN public.shops s ON s.id = l.shop_id
    LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
    LEFT JOIN public.shop_commerce_settings scs ON scs.shop_id = l.shop_id
    WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids)
    GROUP BY l.shop_id, s.shop_name, scs.payment_mode, scs.payment_gateway
    ORDER BY l.shop_id
  LOOP
    v_shop_subtotal := v_shop.subtotal;
    v_shop_discount := CASE
      WHEN v_eligible_subtotal > 0 THEN round(v_discount_total * (
        SELECT coalesce(sum((l.price + coalesce(lv.price_adjustment, 0)) * ci.quantity), 0)
        FROM public.cart_items ci
        JOIN public.listings l ON l.id = ci.listing_id
        LEFT JOIN public.listing_variations lv ON lv.id = ci.variant_id
        WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids)
          AND l.shop_id = v_shop.shop_id
          AND (v_discount.shop_id IS NULL OR l.shop_id = v_discount.shop_id)
          AND (v_discount.eligible_listings IS NULL OR l.id = ANY(v_discount.eligible_listings))
      ) / v_eligible_subtotal, 2)
      ELSE 0
    END;
    v_shop_total := greatest(0, v_shop_subtotal - v_shop_discount);

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
      AND l.shop_id = v_shop.shop_id;

    v_order_result := public.create_customer_order(jsonb_build_object(
      'user_id', v_user_id,
      'cart_items', v_items,
      'shipping_address_id', p_shipping_address_id,
      'billing_address_id', coalesce(p_billing_address_id, p_shipping_address_id),
      'customer_notes', nullif(p_notes_by_shop->>v_shop.shop_id::text, ''),
      'payment_mode', p_payment_mode,
      'currency', v_cart.currency,
      'subtotal_amount', v_shop_subtotal,
      'shipping_amount', 0,
      'tax_amount', 0,
      'discount_amount', v_shop_discount,
      'total_amount', v_shop_total,
      'discount_codes', CASE WHEN v_discount.id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_discount.discount_code) END,
      'order_source', 'sheconomy-one-atomic',
      'order_metadata', jsonb_build_object(
        'created_via', 'atomic_marketplace_checkout',
        'checkout_group_id', v_group.id,
        'discount_info', CASE WHEN v_discount.id IS NULL THEN NULL ELSE jsonb_build_object(
          'discount_profile_id', v_discount.id,
          'discount_name', v_discount.discount_name,
          'total_discount', v_shop_discount
        ) END,
        'gift', jsonb_build_object('is_gift', v_shop.shop_id = ANY(p_gift_shop_ids))
      )
    ));

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
      v_shop_total, v_cart.currency,
      v_key || ':' || v_shop.shop_id::text,
      jsonb_build_object('order_number', v_order_result->>'order_number')
    );
  END LOOP;

  INSERT INTO public.inventory_reservations (
    checkout_group_id, listing_id, variation_id, quantity, status,
    expires_at, converted_at
  )
  SELECT v_group.id, ci.listing_id, ci.variant_id, sum(ci.quantity),
    CASE WHEN p_payment_mode = 'cod' THEN 'converted' ELSE 'reserved' END,
    v_group.expires_at, CASE WHEN p_payment_mode = 'cod' THEN now() ELSE NULL END
  FROM public.cart_items ci
  WHERE ci.cart_id = p_cart_id AND ci.id = ANY(p_cart_item_ids)
  GROUP BY ci.listing_id, ci.variant_id;

  IF v_discount.id IS NOT NULL AND v_discount_total > 0 THEN
    UPDATE public.discount_profiles
    SET total_uses = coalesce(total_uses, 0) + 1, updated_at = now()
    WHERE id = v_discount.id;
  END IF;

  -- Only selected lines are consumed. Other cart lines remain available.
  DELETE FROM public.cart_items
  WHERE cart_id = p_cart_id AND id = ANY(p_cart_item_ids);

  UPDATE public.commerce_checkout_groups
  SET order_ids = v_order_ids,
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
    'total_amount', greatest(0, v_subtotal - v_discount_total),
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

REVOKE ALL ON FUNCTION public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.resume_checkout_payment(p_checkout_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.commerce_checkout_groups%ROWTYPE;
BEGIN
  SELECT * INTO v_group FROM public.commerce_checkout_groups
  WHERE id = p_checkout_group_id AND buyer_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout not found'; END IF;
  IF v_group.status IN ('paid', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Checkout cannot be resumed';
  END IF;
  UPDATE public.commerce_checkout_payment_steps
  SET attempt_count = attempt_count + 1,
      status = CASE WHEN status = 'failed' THEN 'pending' ELSE status END,
      last_error = NULL,
      updated_at = now()
  WHERE checkout_group_id = v_group.id AND status IN ('pending', 'failed', 'requires_action');
  UPDATE public.commerce_checkout_groups
  SET status = 'awaiting_payment', last_error = NULL, updated_at = now()
  WHERE id = v_group.id;
  RETURN jsonb_build_object(
    'checkout_group_id', v_group.id,
    'status', 'awaiting_payment',
    'payment_steps', (
      SELECT coalesce(jsonb_agg(to_jsonb(ps) - 'metadata'), '[]'::jsonb)
      FROM public.commerce_checkout_payment_steps ps
      WHERE ps.checkout_group_id = v_group.id
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.resume_checkout_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resume_checkout_payment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._restore_checkout_cart(
  p_group_id uuid,
  p_cart_id uuid,
  p_order_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cart_items (
    cart_id, listing_id, variant_id, quantity, unit_price, total_price,
    title, image_url, shop_name, shop_id, variant_name, variant_value, item_metadata
  )
  SELECT
    p_cart_id, oi.listing_id,
    nullif(oi.variation_details->>'variant_id', '')::uuid,
    oi.quantity, oi.unit_price, oi.unit_price * oi.quantity,
    oi.product_title, NULL, s.shop_name, oi.vendor_id,
    oi.variation_details->>'variant_name', oi.variation_details->>'variant_value',
    jsonb_build_object('restored_from_checkout_group', p_group_id)
  FROM public.order_items oi
  JOIN public.shops s ON s.id = oi.vendor_id
  WHERE oi.order_id = ANY(p_order_ids)
    AND oi.listing_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.cart_items ci
      WHERE ci.cart_id = p_cart_id
        AND ci.listing_id = oi.listing_id
        AND ci.variant_id IS NOT DISTINCT FROM nullif(oi.variation_details->>'variant_id', '')::uuid
    );
END;
$$;
REVOKE ALL ON FUNCTION public._restore_checkout_cart(uuid, uuid, uuid[]) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cancel_checkout_payment(p_checkout_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.commerce_checkout_groups%ROWTYPE;
BEGIN
  SELECT * INTO v_group FROM public.commerce_checkout_groups
  WHERE id = p_checkout_group_id AND buyer_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout not found'; END IF;
  IF v_group.status IN ('paid', 'cancelled') THEN
    RAISE EXCEPTION 'Checkout cannot be cancelled';
  END IF;
  UPDATE public.listings l
  SET quantity = CASE WHEN l.quantity IS NULL THEN NULL ELSE l.quantity + r.quantity END,
      updated_at = now()
  FROM public.inventory_reservations r
  WHERE r.checkout_group_id = v_group.id
    AND r.listing_id = l.id
    AND r.status = 'reserved';
  UPDATE public.listing_variations lv
  SET stock = CASE WHEN lv.stock IS NULL THEN NULL ELSE lv.stock + r.quantity END,
      updated_at = now()
  FROM public.inventory_reservations r
  WHERE r.checkout_group_id = v_group.id
    AND r.variation_id = lv.id
    AND r.status = 'reserved';
  UPDATE public.inventory_reservations
  SET status = 'released', released_at = now()
  WHERE checkout_group_id = v_group.id AND status = 'reserved';
  UPDATE public.order_items
  SET item_status = 'cancelled', updated_at = now()
  WHERE order_id = ANY(v_group.order_ids) AND item_status = 'pending';
  UPDATE public.orders
  SET order_status = 'cancelled', updated_at = now()
  WHERE id = ANY(v_group.order_ids) AND order_status = 'pending';
  UPDATE public.order_payments
  SET payment_status = 'cancelled', updated_at = now()
  WHERE order_id = ANY(v_group.order_ids) AND payment_status IN ('pending', 'processing');
  PERFORM public._restore_checkout_cart(v_group.id, v_group.cart_id, v_group.order_ids);
  UPDATE public.commerce_checkout_payment_steps
  SET status = 'cancelled', updated_at = now()
  WHERE checkout_group_id = v_group.id AND status <> 'paid';
  UPDATE public.commerce_checkout_groups
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE id = v_group.id;
  RETURN jsonb_build_object('checkout_group_id', v_group.id, 'status', 'cancelled');
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_checkout_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_checkout_payment(uuid) TO authenticated;

-- Seller inquiry lifecycle.
ALTER TABLE public.listing_inquiries
  ADD COLUMN IF NOT EXISTS seller_reply text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE OR REPLACE FUNCTION public.reply_to_listing_inquiry(
  p_inquiry_id uuid,
  p_reply text,
  p_close boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inquiry public.listing_inquiries%ROWTYPE;
BEGIN
  IF char_length(trim(coalesce(p_reply, ''))) < 2 THEN
    RAISE EXCEPTION 'Reply is required';
  END IF;
  SELECT * INTO v_inquiry FROM public.listing_inquiries
  WHERE id = p_inquiry_id AND seller_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inquiry not found'; END IF;
  UPDATE public.listing_inquiries
  SET seller_reply = trim(p_reply),
      replied_at = now(),
      status = CASE WHEN p_close THEN 'closed' ELSE 'answered' END,
      closed_at = CASE WHEN p_close THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = v_inquiry.id;
  RETURN jsonb_build_object('id', v_inquiry.id, 'status', CASE WHEN p_close THEN 'closed' ELSE 'answered' END);
END;
$$;
REVOKE ALL ON FUNCTION public.reply_to_listing_inquiry(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reply_to_listing_inquiry(uuid, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_bulk_update_listings(
  p_shop_id uuid,
  p_listing_ids uuid[],
  p_status text DEFAULT NULL,
  p_price_percent numeric DEFAULT NULL,
  p_stock_delta integer DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'active', 'paused', 'sold_out', 'archived') THEN
    RAISE EXCEPTION 'Invalid listing status';
  END IF;
  UPDATE public.listings
  SET listing_status = coalesce(p_status::listing_status_enum, listing_status),
      is_active = CASE WHEN p_status IS NULL THEN is_active WHEN p_status = 'active' THEN true ELSE false END,
      price = CASE WHEN p_price_percent IS NULL THEN price ELSE greatest(0, round(price * (1 + p_price_percent / 100), 2)) END,
      quantity = CASE WHEN p_stock_delta IS NULL OR quantity IS NULL THEN quantity ELSE greatest(0, quantity + p_stock_delta) END,
      stock = CASE WHEN p_stock_delta IS NULL OR stock IS NULL THEN stock ELSE greatest(0, stock + p_stock_delta) END,
      category = coalesce(nullif(trim(p_category), ''), category),
      updated_at = now()
  WHERE shop_id = p_shop_id AND id = ANY(p_listing_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_bulk_update_listings(uuid, uuid[], text, numeric, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_bulk_update_listings(uuid, uuid[], text, numeric, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_shop_section(
  p_shop_id uuid,
  p_section_id uuid DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_listing_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF char_length(trim(coalesce(p_name, ''))) < 2 THEN RAISE EXCEPTION 'Section name is required'; END IF;
  IF p_section_id IS NULL THEN
    INSERT INTO public.shop_sections (shop_id, section_name, description, is_active, display_order, slug)
    VALUES (
      p_shop_id, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_is_active,
      coalesce((SELECT max(display_order) + 1 FROM public.shop_sections WHERE shop_id = p_shop_id), 0),
      lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'))
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.shop_sections
    SET section_name = trim(p_name),
        description = nullif(trim(coalesce(p_description, '')), ''),
        is_active = p_is_active,
        updated_at = now()
    WHERE id = p_section_id AND shop_id = p_shop_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Section not found'; END IF;
  END IF;
  DELETE FROM public.listing_sections WHERE section_id = v_id;
  INSERT INTO public.listing_sections (listing_id, section_id)
  SELECT l.id, v_id FROM public.listings l
  WHERE l.shop_id = p_shop_id AND l.id = ANY(p_listing_ids)
  ON CONFLICT DO NOTHING;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_shop_section(uuid, uuid, text, text, boolean, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shop_section(uuid, uuid, text, text, boolean, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_fulfillment_exception(
  p_fulfillment_id uuid,
  p_note text,
  p_retry_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_f public.order_fulfillments%ROWTYPE;
BEGIN
  SELECT f.* INTO v_f
  FROM public.order_fulfillments f
  JOIN public.order_items oi ON oi.id = f.order_item_id
  JOIN public.shops s ON s.id = oi.vendor_id
  WHERE f.id = p_fulfillment_id AND s.user_id = auth.uid()
  FOR UPDATE OF f;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  UPDATE public.order_fulfillments
  SET last_failure_reason = nullif(trim(coalesce(p_note, '')), ''),
      last_failure_at = now(),
      next_retry_at = p_retry_at,
      attempt_count = attempt_count + 1,
      updated_at = now()
  WHERE id = v_f.id;
  INSERT INTO public.fulfillment_events (
    fulfillment_id, event_type, event_description, triggered_by,
    source_system, event_timestamp, event_data
  ) VALUES (
    v_f.id, 'exception_resolution',
    coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Fulfillment exception reviewed'),
    auth.uid()::text, 'vendor_console', now(),
    jsonb_build_object('retry_at', p_retry_at)
  );
  RETURN jsonb_build_object('id', v_f.id, 'next_retry_at', p_retry_at);
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_fulfillment_exception(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_fulfillment_exception(uuid, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_reply_to_review(
  p_review_id uuid,
  p_reply text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF char_length(trim(coalesce(p_reply, ''))) < 2 THEN RAISE EXCEPTION 'Reply is required'; END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.listing_reviews r
    JOIN public.listings l ON l.id = r.listing_id
    JOIN public.shops s ON s.id = l.shop_id
    WHERE r.id = p_review_id AND s.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Review not found'; END IF;
  INSERT INTO public.listing_review_replies (
    review_id, replier_id, reply_text, is_vendor_reply, is_public
  ) VALUES (p_review_id, auth.uid(), trim(p_reply), true, true)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_reply_to_review(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_reply_to_review(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_create_promotion(
  p_shop_id uuid,
  p_name text,
  p_code text,
  p_discount_type text,
  p_discount_value numeric,
  p_min_order_amount numeric DEFAULT 0,
  p_max_discount_amount numeric DEFAULT NULL,
  p_valid_until timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_discount_type NOT IN ('percentage', 'fixed') OR p_discount_value <= 0 THEN
    RAISE EXCEPTION 'Invalid discount';
  END IF;
  IF p_discount_type = 'percentage' AND p_discount_value > 100 THEN
    RAISE EXCEPTION 'Percentage cannot exceed 100';
  END IF;
  INSERT INTO public.discount_profiles (
    shop_id, discount_name, discount_code, discount_type, discount_value,
    applies_to, min_order_amount, max_discount_amount, valid_from, valid_until,
    is_active, source, discount_currency
  ) VALUES (
    p_shop_id, trim(p_name), upper(nullif(trim(p_code), '')), p_discount_type,
    p_discount_value, 'order', greatest(0, coalesce(p_min_order_amount, 0)),
    p_max_discount_amount, now(), p_valid_until, true, 'vendor_console',
    coalesce((SELECT shop_currency FROM public.shops WHERE id = p_shop_id), 'INR')
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_create_promotion(uuid, text, text, text, numeric, numeric, numeric, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_create_promotion(uuid, text, text, text, numeric, numeric, numeric, timestamptz) TO authenticated;

-- Variation stock is reserved and consumed alongside base listing stock.
CREATE OR REPLACE FUNCTION public._consume_checkout_variation_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.variation_id IS NOT NULL AND NEW.status IN ('reserved', 'converted') THEN
    UPDATE public.listing_variations
    SET stock = CASE WHEN stock IS NULL THEN NULL ELSE greatest(0, stock - NEW.quantity) END,
        updated_at = now()
    WHERE id = NEW.variation_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._consume_checkout_variation_stock() FROM PUBLIC;

DROP TRIGGER IF EXISTS consume_checkout_variation_stock ON public.inventory_reservations;
CREATE TRIGGER consume_checkout_variation_stock
AFTER INSERT ON public.inventory_reservations
FOR EACH ROW EXECUTE FUNCTION public._consume_checkout_variation_stock();

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhooks_provider_event_uidx
  ON public.payment_webhooks (provider, webhook_id);

-- Service-only transition used after a provider signature has been verified by
-- the payment webhook Edge Function.
CREATE OR REPLACE FUNCTION public.process_checkout_payment_webhook(
  p_payment_step_id uuid,
  p_shop_id uuid,
  p_provider payment_provider_enum,
  p_webhook_id text,
  p_event_type text,
  p_status text,
  p_provider_reference text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step public.commerce_checkout_payment_steps%ROWTYPE;
  v_inserted uuid;
  v_group_status text;
BEGIN
  IF p_status NOT IN ('requires_action', 'processing', 'paid', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  INSERT INTO public.payment_webhooks (
    shop_id, provider, webhook_id, event_type, payload, processed
  ) VALUES (
    p_shop_id, p_provider, p_webhook_id, p_event_type, coalesce(p_payload, '{}'::jsonb), false
  )
  ON CONFLICT (provider, webhook_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    RETURN jsonb_build_object('duplicate', true, 'webhook_id', p_webhook_id);
  END IF;

  SELECT * INTO v_step
  FROM public.commerce_checkout_payment_steps
  WHERE id = p_payment_step_id AND shop_id = p_shop_id
  FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE public.payment_webhooks
    SET error_message = 'Payment step not found', retry_count = retry_count + 1, updated_at = now()
    WHERE id = v_inserted;
    RAISE EXCEPTION 'Payment step not found';
  END IF;

  -- Paid is terminal and cannot be reversed by a delayed failure webhook.
  IF v_step.status <> 'paid' OR p_status = 'paid' THEN
    UPDATE public.commerce_checkout_payment_steps
    SET status = p_status,
        provider_reference = coalesce(p_provider_reference, provider_reference),
        last_error = CASE WHEN p_status = 'failed' THEN p_payload->>'error' ELSE NULL END,
        processed_at = CASE WHEN p_status IN ('paid', 'failed', 'cancelled') THEN now() ELSE processed_at END,
        updated_at = now()
    WHERE id = v_step.id;
  END IF;

  UPDATE public.order_payments
  SET payment_status = CASE p_status
        WHEN 'paid' THEN 'completed'::payment_status_enum
        WHEN 'failed' THEN 'failed'::payment_status_enum
        WHEN 'cancelled' THEN 'cancelled'::payment_status_enum
        ELSE 'processing'::payment_status_enum
      END,
      gateway_transaction_id = coalesce(p_provider_reference, gateway_transaction_id),
      processed_at = CASE WHEN p_status = 'paid' THEN now() ELSE processed_at END,
      updated_at = now()
  WHERE order_id = v_step.order_id;

  SELECT CASE
    WHEN bool_and(status = 'paid') THEN 'paid'
    WHEN bool_or(status = 'paid') THEN 'partially_paid'
    WHEN bool_or(status IN ('pending', 'requires_action', 'processing')) THEN 'awaiting_payment'
    WHEN bool_and(status = 'cancelled') THEN 'cancelled'
    ELSE 'failed'
  END INTO v_group_status
  FROM public.commerce_checkout_payment_steps
  WHERE checkout_group_id = v_step.checkout_group_id;

  UPDATE public.commerce_checkout_groups
  SET status = v_group_status,
      paid_at = CASE WHEN v_group_status = 'paid' THEN now() ELSE paid_at END,
      last_error = CASE WHEN v_group_status = 'failed' THEN p_payload->>'error' ELSE NULL END,
      updated_at = now()
  WHERE id = v_step.checkout_group_id;

  IF v_group_status = 'paid' THEN
    UPDATE public.inventory_reservations
    SET status = 'converted', converted_at = now()
    WHERE checkout_group_id = v_step.checkout_group_id AND status = 'reserved';
  END IF;

  UPDATE public.payment_webhooks
  SET processed = true, processed_at = now(), updated_at = now()
  WHERE id = v_inserted;

  RETURN jsonb_build_object(
    'duplicate', false,
    'payment_step_id', v_step.id,
    'checkout_group_id', v_step.checkout_group_id,
    'status', p_status,
    'group_status', v_group_status
  );
END;
$$;
REVOKE ALL ON FUNCTION public.process_checkout_payment_webhook(uuid, uuid, payment_provider_enum, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_checkout_payment_webhook(uuid, uuid, payment_provider_enum, text, text, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.release_expired_checkout_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_count integer := 0;
BEGIN
  FOR v_group IN
    SELECT * FROM public.commerce_checkout_groups
    WHERE status IN ('created', 'awaiting_payment', 'failed')
      AND expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.listings l
    SET quantity = CASE WHEN l.quantity IS NULL THEN NULL ELSE l.quantity + r.quantity END,
        updated_at = now()
    FROM public.inventory_reservations r
    WHERE r.checkout_group_id = v_group.id
      AND r.listing_id = l.id
      AND r.status = 'reserved';
    UPDATE public.listing_variations lv
    SET stock = CASE WHEN lv.stock IS NULL THEN NULL ELSE lv.stock + r.quantity END,
        updated_at = now()
    FROM public.inventory_reservations r
    WHERE r.checkout_group_id = v_group.id
      AND r.variation_id = lv.id
      AND r.status = 'reserved';
    UPDATE public.inventory_reservations
    SET status = 'expired', released_at = now()
    WHERE checkout_group_id = v_group.id AND status = 'reserved';
    UPDATE public.commerce_checkout_payment_steps
    SET status = 'expired', updated_at = now()
    WHERE checkout_group_id = v_group.id AND status <> 'paid';
    UPDATE public.order_items
    SET item_status = 'cancelled', updated_at = now()
    WHERE order_id = ANY(v_group.order_ids) AND item_status = 'pending';
    UPDATE public.orders
    SET order_status = 'cancelled', updated_at = now()
    WHERE id = ANY(v_group.order_ids) AND order_status = 'pending';
    UPDATE public.order_payments
    SET payment_status = 'cancelled', updated_at = now()
    WHERE order_id = ANY(v_group.order_ids) AND payment_status IN ('pending', 'processing');
    PERFORM public._restore_checkout_cart(v_group.id, v_group.cart_id, v_group.order_ids);
    UPDATE public.commerce_checkout_groups
    SET status = 'expired', updated_at = now()
    WHERE id = v_group.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.release_expired_checkout_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_expired_checkout_reservations() TO service_role;

CREATE OR REPLACE FUNCTION public._derive_listing_inquiry_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT l.shop_id, s.user_id
  INTO NEW.shop_id, NEW.seller_id
  FROM public.listings l
  JOIN public.shops s ON s.id = l.shop_id
  WHERE l.id = NEW.listing_id;
  IF NEW.shop_id IS NULL OR NEW.seller_id IS NULL THEN
    RAISE EXCEPTION 'Listing is unavailable';
  END IF;
  NEW.buyer_id := auth.uid();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._derive_listing_inquiry_participants() FROM PUBLIC;
DROP TRIGGER IF EXISTS derive_listing_inquiry_participants ON public.listing_inquiries;
CREATE TRIGGER derive_listing_inquiry_participants
BEFORE INSERT ON public.listing_inquiries
FOR EACH ROW EXECUTE FUNCTION public._derive_listing_inquiry_participants();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-expired-marketplace-checkouts') THEN
    PERFORM cron.schedule(
      'release-expired-marketplace-checkouts',
      '*/5 * * * *',
      'SELECT public.release_expired_checkout_reservations()'
    );
  END IF;
END;
$$;
