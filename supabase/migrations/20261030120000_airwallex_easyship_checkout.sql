-- Airwallex Connected Accounts + Easyship DDP checkout rail.
-- Replaces PayU as the online payout gate; COD unchanged.

ALTER TYPE public.payment_provider_enum ADD VALUE IF NOT EXISTS 'airwallex';

CREATE TABLE IF NOT EXISTS public.shop_airwallex_kyc (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  legal_entity_type text NOT NULL DEFAULT 'BUSINESS'
    CHECK (legal_entity_type IN ('BUSINESS', 'INDIVIDUAL')),
  legal_name text NOT NULL DEFAULT '',
  business_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT 'IN',
  registration_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  business_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  individual_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  bank_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  document_paths jsonb NOT NULL DEFAULT '{}'::jsonb,
  agreed_to_terms boolean NOT NULL DEFAULT false,
  agreed_to_data_usage boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'submitted',
      'changes_requested',
      'awx_pending',
      'awx_active',
      'rejected'
    )),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  airwallex_account_id text,
  airwallex_status text,
  airwallex_error text,
  airwallex_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_airwallex_kyc_status_idx
  ON public.shop_airwallex_kyc (status);

ALTER TABLE public.shop_airwallex_kyc ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.shop_airwallex_kyc_enforce()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
  is_admin boolean := false;
BEGIN
  IF jwt_role = 'service_role' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'A'
  ) INTO is_admin;

  IF is_admin THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status = 'awx_active' AND OLD.status IS DISTINCT FROM 'awx_active' THEN
        RAISE EXCEPTION 'awx_active is set by the platform';
      END IF;
      IF NEW.status = 'awx_pending' AND OLD.status IS DISTINCT FROM 'awx_pending' THEN
        RAISE EXCEPTION 'awx_pending is set by the platform';
      END IF;
      NEW.airwallex_account_id := OLD.airwallex_account_id;
      NEW.airwallex_status := OLD.airwallex_status;
      NEW.airwallex_error := OLD.airwallex_error;
      NEW.airwallex_payload := OLD.airwallex_payload;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'invalid payout application status';
    END IF;
    NEW.airwallex_account_id := NULL;
    NEW.airwallex_status := NULL;
    NEW.airwallex_error := NULL;
    NEW.airwallex_payload := NULL;
    NEW.admin_note := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF OLD.status NOT IN ('draft', 'changes_requested') THEN
    RAISE EXCEPTION 'payout application is locked';
  END IF;
  IF NEW.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'invalid payout application status';
  END IF;

  NEW.airwallex_account_id := OLD.airwallex_account_id;
  NEW.airwallex_status := OLD.airwallex_status;
  NEW.airwallex_error := OLD.airwallex_error;
  NEW.airwallex_payload := OLD.airwallex_payload;
  NEW.admin_note := OLD.admin_note;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_airwallex_kyc_enforce_trg ON public.shop_airwallex_kyc;
CREATE TRIGGER shop_airwallex_kyc_enforce_trg
  BEFORE INSERT OR UPDATE ON public.shop_airwallex_kyc
  FOR EACH ROW
  EXECUTE FUNCTION public.shop_airwallex_kyc_enforce();

DROP POLICY IF EXISTS shop_airwallex_kyc_owner_select ON public.shop_airwallex_kyc;
CREATE POLICY shop_airwallex_kyc_owner_select
  ON public.shop_airwallex_kyc
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'A'
    )
  );

DROP POLICY IF EXISTS shop_airwallex_kyc_owner_insert ON public.shop_airwallex_kyc;
CREATE POLICY shop_airwallex_kyc_owner_insert
  ON public.shop_airwallex_kyc
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS shop_airwallex_kyc_owner_update ON public.shop_airwallex_kyc;
CREATE POLICY shop_airwallex_kyc_owner_update
  ON public.shop_airwallex_kyc
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'A'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'A'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.shop_airwallex_kyc TO authenticated;
GRANT ALL ON public.shop_airwallex_kyc TO service_role;

-- No Airwallex KYC row OR status awx_active.
CREATE OR REPLACE FUNCTION public.shop_airwallex_kyc_allows_orders(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.shop_airwallex_kyc k
    WHERE k.shop_id = p_shop_id
      AND k.status IS DISTINCT FROM 'awx_active'
  );
$$;

REVOKE ALL ON FUNCTION public.shop_airwallex_kyc_allows_orders(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_airwallex_kyc_allows_orders(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.orders_require_payu_kyc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.shop_airwallex_kyc_allows_orders(NEW.shop_id) THEN
    RAISE EXCEPTION 'This shop is not ready to accept orders yet. Payout verification is still pending.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.airwallex_pending_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  checkout_group_id uuid REFERENCES public.commerce_checkout_groups (id) ON DELETE SET NULL,
  payment_step_id uuid REFERENCES public.commerce_checkout_payment_steps (id) ON DELETE SET NULL,
  payment_intent_id text NOT NULL,
  funds_split_id text,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'awaiting_release_window'
    CHECK (status IN (
      'awaiting_release_window',
      'awaiting_account',
      'releasing',
      'released',
      'failed'
    )),
  hold_reason text,
  error_message text,
  release_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS airwallex_pending_settlements_shop_intent_uidx
  ON public.airwallex_pending_settlements (shop_id, payment_intent_id);

CREATE INDEX IF NOT EXISTS airwallex_pending_settlements_status_idx
  ON public.airwallex_pending_settlements (status);

ALTER TABLE public.airwallex_pending_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS airwallex_pending_settlements_select_owner ON public.airwallex_pending_settlements;
CREATE POLICY airwallex_pending_settlements_select_owner
  ON public.airwallex_pending_settlements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = airwallex_pending_settlements.shop_id
        AND s.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.airwallex_pending_settlements TO authenticated;
GRANT ALL ON public.airwallex_pending_settlements TO service_role;

COMMENT ON TABLE public.airwallex_pending_settlements IS
  'Airwallex Funds Splits held (auto_release=false) until delivery + return window; 100% of item price to Connected Account.';

-- Drop prior 10-arg overload, then recreate with Easyship DDP override param.
DROP FUNCTION IF EXISTS public.atomic_marketplace_checkout(
  uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[], text, jsonb
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

REVOKE ALL ON FUNCTION public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[], text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_marketplace_checkout(uuid, uuid[], uuid, uuid, text, text, jsonb, uuid[], text, jsonb, jsonb) TO authenticated, service_role;

