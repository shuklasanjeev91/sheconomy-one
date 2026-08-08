-- Conflict-safe guest→user cart merge.
-- The previous UPDATE cart_items SET cart_id = user_cart failed when the user
-- already had the same listing/variant (unique_cart_listing_variant), which left
-- guest checkout looking empty after sign-in.

CREATE OR REPLACE FUNCTION public.merge_carts(p_session_id text, p_user_id uuid)
 RETURNS carts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_guest_cart public.carts;
  v_user_cart public.carts;
BEGIN
  SELECT * INTO v_guest_cart
  FROM public.carts
  WHERE session_id = p_session_id AND status = 'active'
  ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  SELECT * INTO v_user_cart
  FROM public.get_or_create_cart(p_user_id, NULL);

  IF v_guest_cart.id IS NULL THEN
    RETURN v_user_cart;
  END IF;

  IF v_guest_cart.id = v_user_cart.id THEN
    RETURN v_user_cart;
  END IF;

  INSERT INTO public.cart_items (
    cart_id, listing_id, variant_id, quantity,
    unit_price, title, image_url, shop_name, shop_id,
    variant_name, variant_value, variant_sku, saved_for_later, item_metadata
  )
  SELECT
    v_user_cart.id, listing_id, variant_id, quantity,
    unit_price, title, image_url, shop_name, shop_id,
    variant_name, variant_value, variant_sku, saved_for_later, item_metadata
  FROM public.cart_items
  WHERE cart_id = v_guest_cart.id
  ON CONFLICT (cart_id, listing_id, variant_id)
  DO UPDATE SET
    quantity = CASE
      WHEN public.cart_items.saved_for_later AND NOT EXCLUDED.saved_for_later THEN EXCLUDED.quantity
      WHEN EXCLUDED.saved_for_later AND NOT public.cart_items.saved_for_later THEN public.cart_items.quantity
      ELSE public.cart_items.quantity + EXCLUDED.quantity
    END,
    unit_price = EXCLUDED.unit_price,
    title = EXCLUDED.title,
    image_url = EXCLUDED.image_url,
    shop_name = EXCLUDED.shop_name,
    shop_id = EXCLUDED.shop_id,
    variant_name = EXCLUDED.variant_name,
    variant_value = EXCLUDED.variant_value,
    variant_sku = EXCLUDED.variant_sku,
    saved_for_later = public.cart_items.saved_for_later AND EXCLUDED.saved_for_later,
    item_metadata = COALESCE(EXCLUDED.item_metadata, public.cart_items.item_metadata),
    updated_at = now();

  DELETE FROM public.cart_items WHERE cart_id = v_guest_cart.id;

  DELETE FROM public.cart_discounts d
  WHERE d.cart_id = v_guest_cart.id
    AND EXISTS (
      SELECT 1
      FROM public.cart_discounts u
      WHERE u.cart_id = v_user_cart.id
        AND u.discount_profile_id IS NOT DISTINCT FROM d.discount_profile_id
    );

  UPDATE public.cart_discounts
  SET cart_id = v_user_cart.id
  WHERE cart_id = v_guest_cart.id;

  UPDATE public.carts
  SET status = 'converted', converted_at = now()
  WHERE id = v_guest_cart.id;

  PERFORM public.update_cart_totals(v_user_cart.id);

  SELECT * INTO v_user_cart FROM public.carts WHERE id = v_user_cart.id;
  RETURN v_user_cart;
END;
$function$;
