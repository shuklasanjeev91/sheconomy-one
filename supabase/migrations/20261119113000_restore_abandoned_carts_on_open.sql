-- When abandoned-cart emails mark carts as abandoned, opening /cart or
-- clicking Buy now must restore those items into the shopper's active cart
-- instead of creating a brand-new empty cart.

CREATE OR REPLACE FUNCTION public.restore_abandoned_cart_items_into(
  p_target_cart_id uuid,
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_source RECORD;
  v_item RECORD;
  v_moved integer := 0;
  v_conflict_id uuid;
BEGIN
  IF p_target_cart_id IS NULL OR p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Pull every open abandoned cart for this user into the active cart.
  FOR v_source IN
    SELECT c.id
    FROM public.carts c
    WHERE c.user_id = p_user_id
      AND c.id <> p_target_cart_id
      AND c.status = 'abandoned'
      AND c.converted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.cart_items ci
        WHERE ci.cart_id = c.id
      )
    ORDER BY COALESCE(c.last_activity_at, c.updated_at, c.created_at) DESC
  LOOP
    FOR v_item IN
      SELECT *
      FROM public.cart_items
      WHERE cart_id = v_source.id
    LOOP
      SELECT t.id
      INTO v_conflict_id
      FROM public.cart_items t
      WHERE t.cart_id = p_target_cart_id
        AND t.listing_id = v_item.listing_id
        AND t.variant_id IS NOT DISTINCT FROM v_item.variant_id
      LIMIT 1;

      IF v_conflict_id IS NULL THEN
        -- Preserve cart_item id so email ± links keep working.
        UPDATE public.cart_items
        SET cart_id = p_target_cart_id, updated_at = now()
        WHERE id = v_item.id;
        v_moved := v_moved + 1;
      ELSE
        UPDATE public.cart_items t
        SET
          quantity = CASE
            WHEN t.saved_for_later AND NOT v_item.saved_for_later THEN v_item.quantity
            WHEN v_item.saved_for_later AND NOT t.saved_for_later THEN t.quantity
            ELSE t.quantity + v_item.quantity
          END,
          unit_price = v_item.unit_price,
          title = v_item.title,
          image_url = v_item.image_url,
          shop_name = v_item.shop_name,
          shop_id = v_item.shop_id,
          variant_name = v_item.variant_name,
          variant_value = v_item.variant_value,
          variant_sku = v_item.variant_sku,
          saved_for_later = t.saved_for_later AND v_item.saved_for_later,
          item_metadata = COALESCE(v_item.item_metadata, t.item_metadata),
          updated_at = now()
        WHERE t.id = v_conflict_id;

        DELETE FROM public.cart_items WHERE id = v_item.id;
        v_moved := v_moved + 1;
      END IF;
    END LOOP;

    UPDATE public.carts
    SET status = 'converted', converted_at = now(), updated_at = now()
    WHERE id = v_source.id
      AND NOT EXISTS (SELECT 1 FROM public.cart_items ci WHERE ci.cart_id = v_source.id);
  END LOOP;

  IF v_moved > 0 THEN
    PERFORM public.update_cart_totals(p_target_cart_id);
  END IF;

  RETURN v_moved;
END;
$fn$;

REVOKE ALL ON FUNCTION public.restore_abandoned_cart_items_into(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_abandoned_cart_items_into(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_or_create_cart(
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS carts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_cart public.carts;
BEGIN
  IF p_user_id IS NULL AND p_session_id IS NULL THEN
    RAISE EXCEPTION 'Either user_id or session_id must be provided';
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_cart
    FROM public.carts
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    -- No active cart: reactivate the newest abandoned cart that still has items.
    IF v_cart.id IS NULL THEN
      SELECT * INTO v_cart
      FROM public.carts c
      WHERE c.user_id = p_user_id
        AND c.status = 'abandoned'
        AND c.converted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.cart_items ci
          WHERE ci.cart_id = c.id AND ci.saved_for_later = false
        )
      ORDER BY COALESCE(c.last_activity_at, c.updated_at, c.created_at) DESC
      LIMIT 1;

      IF v_cart.id IS NOT NULL THEN
        UPDATE public.carts
        SET status = 'active', last_activity_at = now(), updated_at = now()
        WHERE id = v_cart.id
        RETURNING * INTO v_cart;
      END IF;
    END IF;
  ELSE
    SELECT * INTO v_cart
    FROM public.carts
    WHERE session_id = p_session_id AND status = 'active'
    ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    IF v_cart.id IS NULL THEN
      SELECT * INTO v_cart
      FROM public.carts c
      WHERE c.session_id = p_session_id
        AND c.status = 'abandoned'
        AND c.converted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.cart_items ci
          WHERE ci.cart_id = c.id AND ci.saved_for_later = false
        )
      ORDER BY COALESCE(c.last_activity_at, c.updated_at, c.created_at) DESC
      LIMIT 1;

      IF v_cart.id IS NOT NULL THEN
        UPDATE public.carts
        SET status = 'active', last_activity_at = now(), updated_at = now()
        WHERE id = v_cart.id
        RETURNING * INTO v_cart;
      END IF;
    END IF;
  END IF;

  IF v_cart.id IS NULL THEN
    INSERT INTO public.carts (user_id, session_id)
    VALUES (p_user_id, p_session_id)
    RETURNING * INTO v_cart;
  END IF;

  -- Fold sibling abandoned carts into this active cart (email return-to-cart).
  IF p_user_id IS NOT NULL THEN
    PERFORM public.restore_abandoned_cart_items_into(v_cart.id, p_user_id);
    SELECT * INTO v_cart FROM public.carts WHERE id = v_cart.id;
  END IF;

  UPDATE public.carts
  SET last_activity_at = now()
  WHERE id = v_cart.id
  RETURNING * INTO v_cart;

  RETURN v_cart;
END;
$fn$;

COMMENT ON FUNCTION public.get_or_create_cart(uuid, text) IS
  'Returns the active cart, reactivating/merging abandoned carts with items so email Buy now / Return to cart is not empty.';

-- Heal current shoppers who already got an empty active cart after the reminder.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT c.user_id, c.id AS active_cart_id
    FROM public.carts c
    WHERE c.status = 'active'
      AND c.user_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.carts a
        JOIN public.cart_items ci ON ci.cart_id = a.id
        WHERE a.user_id = c.user_id
          AND a.status = 'abandoned'
          AND a.converted_at IS NULL
      )
  LOOP
    PERFORM public.restore_abandoned_cart_items_into(r.active_cart_id, r.user_id);
  END LOOP;
END $$;
