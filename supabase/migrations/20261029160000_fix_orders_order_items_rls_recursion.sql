-- Fix infinite RLS recursion between orders ↔ order_items.
-- Phase 5 orders_vendor_read_access SELECTs order_items, while buyer
-- order_items policies SELECT orders → nested PostgREST embeds blow up.

CREATE OR REPLACE FUNCTION public.buyer_owns_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.buyer_owns_order(uuid) IS
  'RLS helper: true when auth.uid() owns the order (bypasses orders RLS to avoid recursion).';

CREATE OR REPLACE FUNCTION public.vendor_can_read_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.shops s ON s.id = oi.vendor_id
    WHERE oi.order_id = p_order_id
      AND s.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.vendor_can_read_order(uuid) IS
  'RLS helper: true when auth.uid() owns a shop on the order (bypasses order_items RLS).';

REVOKE ALL ON FUNCTION public.buyer_owns_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_can_read_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buyer_owns_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_can_read_order(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
CREATE POLICY "Users can view their own order items"
  ON public.order_items
  FOR SELECT
  TO public
  USING (public.buyer_owns_order(order_id));

DROP POLICY IF EXISTS "Users can insert order items for their own orders" ON public.order_items;
CREATE POLICY "Users can insert order items for their own orders"
  ON public.order_items
  FOR INSERT
  TO public
  WITH CHECK (public.buyer_owns_order(order_id));

DROP POLICY IF EXISTS orders_vendor_read_access ON public.orders;
CREATE POLICY orders_vendor_read_access
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND public.vendor_can_read_order(id)
  );

COMMENT ON POLICY orders_vendor_read_access ON public.orders IS
  'Vendors may SELECT orders that include their shop line items (via SECURITY DEFINER helper).';
