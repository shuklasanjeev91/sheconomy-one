-- Normalize customer_country before insert (see 20260723170500_normalize_iso_country_code.sql).
CREATE OR REPLACE FUNCTION public.create_customer_order(order_data JSONB)
RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_cart_items JSONB;
  v_item JSONB;
  v_order_item_id UUID;
  v_listing RECORD;
  v_shipping_address RECORD;
  v_billing_address RECORD;
  v_tax_amount NUMERIC := 0;
  v_subtotal_amount NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_shipping_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_result JSONB;
  v_vendor_count INTEGER := 0;
  v_delivery_date DATE;
  v_shop_currency TEXT;
  v_customer_currency TEXT;
  v_customer_country TEXT;
  v_customer_subtotal_amount NUMERIC := 0;
  v_customer_shipping_amount NUMERIC := 0;
  v_customer_tax_amount NUMERIC := 0;
  v_customer_discount_amount NUMERIC := 0;
  v_customer_total_amount NUMERIC := 0;
  v_unit_price NUMERIC;
  v_quantity INTEGER;
  v_item_discount_amount NUMERIC;
  v_item_subtotal NUMERIC;
  v_item_total NUMERIC;
BEGIN
  v_cart_items := order_data->'cart_items';

  v_shop_currency := COALESCE(order_data->>'currency', 'INR');
  v_customer_currency := COALESCE(order_data->>'customer_currency', v_shop_currency);
  v_customer_country := public.normalize_iso_country_code(
    COALESCE(order_data->>'customer_country', 'IN')
  );

  IF (order_data->>'user_id') IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF v_cart_items IS NULL OR jsonb_array_length(v_cart_items) = 0 THEN
    RAISE EXCEPTION 'Cart items are required';
  END IF;

  IF (order_data->>'shipping_address_id') IS NULL THEN
    RAISE EXCEPTION 'Shipping address is required';
  END IF;

  SELECT country, state, city, postal_code, address_line_1, address_line_2, address_label
  INTO v_shipping_address
  FROM public.addresses
  WHERE id = (order_data->>'shipping_address_id')::UUID;

  IF v_shipping_address IS NULL THEN
    RAISE EXCEPTION 'Shipping address not found';
  END IF;

  IF (order_data->>'billing_address_id') IS NOT NULL THEN
    SELECT country, state, city, postal_code, address_line_1, address_line_2, address_label
    INTO v_billing_address
    FROM public.addresses
    WHERE id = (order_data->>'billing_address_id')::UUID;
  ELSE
    v_billing_address := v_shipping_address;
  END IF;

  v_order_number := generate_order_number();

  IF (order_data->>'subtotal_amount') IS NOT NULL THEN
    v_subtotal_amount := (order_data->>'subtotal_amount')::NUMERIC;
    v_shipping_amount := COALESCE((order_data->>'shipping_amount')::NUMERIC, 0);
    v_tax_amount := COALESCE((order_data->>'tax_amount')::NUMERIC, 0);
    v_discount_amount := COALESCE((order_data->>'discount_amount')::NUMERIC, 0);
    v_total_amount := COALESCE((order_data->>'total_amount')::NUMERIC,
                               v_subtotal_amount + v_shipping_amount + v_tax_amount - v_discount_amount);
    v_customer_subtotal_amount := COALESCE((order_data->>'customer_subtotal_amount')::NUMERIC, v_subtotal_amount);
    v_customer_shipping_amount := COALESCE((order_data->>'customer_shipping_amount')::NUMERIC, v_shipping_amount);
    v_customer_tax_amount := COALESCE((order_data->>'customer_tax_amount')::NUMERIC, v_tax_amount);
    v_customer_discount_amount := COALESCE((order_data->>'customer_discount_amount')::NUMERIC, v_discount_amount);
    v_customer_total_amount := COALESCE((order_data->>'customer_total_amount')::NUMERIC, v_total_amount);
  ELSE
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_cart_items)
    LOOP
      v_unit_price := (v_item->>'unit_price')::NUMERIC;
      v_quantity := (v_item->>'quantity')::INTEGER;
      v_item_subtotal := v_unit_price * v_quantity;
      v_item_discount_amount := COALESCE((v_item->>'item_discount_amount')::NUMERIC, 0);
      v_subtotal_amount := v_subtotal_amount + v_item_subtotal;
      v_discount_amount := v_discount_amount + v_item_discount_amount;
    END LOOP;

    IF order_data->'discount_codes' IS NOT NULL
       AND jsonb_array_length(order_data->'discount_codes') > 0 THEN
      v_discount_amount := v_discount_amount
        + COALESCE((order_data->'order_metadata'->'discount_info'->>'total_discount')::NUMERIC, 0);
    END IF;

    v_shipping_amount := COALESCE((order_data->>'shipping_amount')::NUMERIC, 0);
    v_total_amount := v_subtotal_amount + v_shipping_amount - v_discount_amount;
    v_customer_subtotal_amount := v_subtotal_amount;
    v_customer_shipping_amount := v_shipping_amount;
    v_customer_tax_amount := v_tax_amount;
    v_customer_discount_amount := v_discount_amount;
    v_customer_total_amount := v_total_amount;
  END IF;

  v_delivery_date := COALESCE(
    (order_data->>'estimated_delivery_date')::DATE,
    CURRENT_DATE + INTERVAL '7 days'
  );

  INSERT INTO public.orders (
    id, order_number, user_id, shipping_address_id, billing_address_id,
    subtotal_amount, shipping_amount, tax_amount, discount_amount, total_amount,
    currency, customer_currency, customer_country,
    customer_subtotal_amount, customer_shipping_amount, customer_tax_amount,
    customer_discount_amount, customer_total_amount,
    order_status, payment_required, customer_notes, special_instructions,
    estimated_delivery_date, requested_delivery_date, order_source, order_metadata
  ) VALUES (
    gen_random_uuid(), v_order_number,
    (order_data->>'user_id')::UUID,
    (order_data->>'shipping_address_id')::UUID,
    COALESCE((order_data->>'billing_address_id')::UUID, (order_data->>'shipping_address_id')::UUID),
    v_subtotal_amount, v_shipping_amount, v_tax_amount, v_discount_amount, v_total_amount,
    v_shop_currency, v_customer_currency, v_customer_country,
    v_customer_subtotal_amount, v_customer_shipping_amount, v_customer_tax_amount,
    v_customer_discount_amount, v_customer_total_amount,
    'pending',
    CASE WHEN (order_data->>'payment_mode') = 'cod' THEN false ELSE true END,
    order_data->>'customer_notes',
    order_data->>'special_instructions',
    v_delivery_date,
    (order_data->>'requested_delivery_date')::DATE,
    COALESCE(order_data->>'order_source', 'web'),
    COALESCE(
      order_data->'order_metadata',
      jsonb_build_object(
        'created_via', 'create_customer_order_function',
        'cart_items_count', jsonb_array_length(v_cart_items)
      )
    )
  ) RETURNING id INTO v_order_id;

  SELECT COUNT(DISTINCT l.shop_id)
  INTO v_vendor_count
  FROM jsonb_array_elements(v_cart_items) AS ci
  JOIN public.listings l ON (ci->>'listing_id')::UUID = l.id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_cart_items)
  LOOP
    SELECT l.id, l.title, l.description, l.shop_id, l.listing_type,
      l.quantity as stock_quantity, l.sku, lrp.return_policy_id, s.shop_name
    INTO v_listing
    FROM public.listings l
    JOIN public.shops s ON l.shop_id = s.id
    LEFT JOIN public.listing_return_policies lrp ON l.id = lrp.listing_id
    WHERE l.id = (v_item->>'listing_id')::UUID;

    IF v_listing.id IS NULL THEN
      RAISE EXCEPTION 'Listing not found: %', v_item->>'listing_id';
    END IF;

    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_item_subtotal := v_unit_price * v_quantity;
    v_item_discount_amount := COALESCE((v_item->>'item_discount_amount')::NUMERIC, 0);
    v_item_total := v_item_subtotal - v_item_discount_amount;

    IF v_listing.stock_quantity IS NOT NULL AND v_listing.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for listing: %. Available: %, Requested: %',
        v_listing.title, v_listing.stock_quantity, v_quantity;
    END IF;

    INSERT INTO public.order_items (
      id, order_id, listing_id, vendor_id, listing_return_policy_id,
      product_title, product_description, product_sku, variation_details,
      quantity, unit_price, total_price, item_discount_amount, item_status
    ) VALUES (
      gen_random_uuid(), v_order_id, v_listing.id, v_listing.shop_id, v_listing.return_policy_id,
      v_listing.title, v_listing.description, v_listing.sku,
      COALESCE(v_item->'variation_details', '{}'::jsonb),
      v_quantity, v_unit_price, v_item_total, v_item_discount_amount, 'pending'
    ) RETURNING id INTO v_order_item_id;

    IF v_item->'listing_discounts' IS NOT NULL
       AND jsonb_array_length(v_item->'listing_discounts') > 0 THEN
      DECLARE v_discount JSONB;
      BEGIN
        FOR v_discount IN SELECT * FROM jsonb_array_elements(v_item->'listing_discounts')
        LOOP
          INSERT INTO public.order_discounts (
            order_item_id, discount_profile_id, discount_name, discount_type,
            discount_amount, applied_at, applied_by_code, discount_scope, discount_metadata
          ) VALUES (
            v_order_item_id,
            (v_discount->>'discount_profile_id')::UUID,
            v_discount->>'discount_name',
            v_discount->>'discount_type',
            (v_discount->>'discount_amount')::NUMERIC,
            now(),
            (v_discount->>'discount_code') IS NOT NULL,
            COALESCE(v_discount->>'discount_scope', 'item'),
            v_discount
          );
        END LOOP;
      END;
    END IF;

    INSERT INTO public.order_delivery (
      order_id, order_item_id, delivery_status, delivery_mode,
      estimated_delivery_date, delivery_address, delivery_instructions
    ) VALUES (
      v_order_id, v_order_item_id, 'pending', 'standard', v_delivery_date,
      jsonb_build_object(
        'country', v_shipping_address.country,
        'state', v_shipping_address.state,
        'city', v_shipping_address.city,
        'postal_code', v_shipping_address.postal_code,
        'address_line_1', v_shipping_address.address_line_1,
        'address_line_2', v_shipping_address.address_line_2,
        'address_label', v_shipping_address.address_label
      ),
      order_data->>'special_instructions'
    );

    UPDATE public.listings
    SET quantity = CASE
          WHEN quantity IS NULL THEN NULL
          ELSE GREATEST(0, quantity - v_quantity)
        END,
        updated_at = now()
    WHERE id = v_listing.id;
  END LOOP;

  INSERT INTO public.order_payments (
    order_id, amount, payment_status, payment_mode, cod_amount, payment_metadata
  ) VALUES (
    v_order_id, v_total_amount, 'pending'::payment_status_enum,
    COALESCE(order_data->>'payment_mode', 'cod')::payment_mode_enum,
    CASE WHEN COALESCE(order_data->>'payment_mode', 'cod') = 'cod' THEN v_total_amount ELSE NULL END,
    jsonb_build_object(
      'currency', v_customer_currency,
      'shop_currency', v_shop_currency,
      'customer_country', v_customer_country,
      'vendor_count', v_vendor_count,
      'customer_total_amount', v_customer_total_amount
    )
  );

  INSERT INTO public.order_status_logs (
    order_id, from_status, to_status, changed_by, note, system_generated, change_metadata
  ) VALUES (
    v_order_id, NULL, 'pending', (order_data->>'user_id')::UUID, 'Order created', true,
    jsonb_build_object(
      'vendor_count', v_vendor_count,
      'item_count', jsonb_array_length(v_cart_items),
      'total_amount', v_total_amount,
      'currency', v_shop_currency,
      'customer_currency', v_customer_currency,
      'customer_total_amount', v_customer_total_amount
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total_amount,
    'currency', v_shop_currency,
    'customer_currency', v_customer_currency,
    'customer_total_amount', v_customer_total_amount,
    'vendor_count', v_vendor_count,
    'item_count', jsonb_array_length(v_cart_items),
    'payment_mode', COALESCE(order_data->>'payment_mode', 'cod'),
    'message', 'Order created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
