-- Phase 5: Seller dashboard RLS assurance.
-- order_items already has order_items_vendor_access (vendor_id → shops.user_id).
-- Tighten orders vendor SELECT so sellers only see orders that include their items.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'order_items'
      AND policyname = 'order_items_vendor_access'
  ) THEN
    CREATE POLICY order_items_vendor_access
      ON public.order_items
      FOR ALL
      TO authenticated
      USING (
        auth.uid() IS NOT NULL
        AND vendor_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid())
      )
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND vendor_id IN (SELECT id FROM public.shops WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Replace overly broad "any shop owner sees all orders" with shop-scoped read.
DROP POLICY IF EXISTS orders_vendor_read_access ON public.orders;
CREATE POLICY orders_vendor_read_access
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.shops s ON s.id = oi.vendor_id
      WHERE oi.order_id = orders.id
        AND s.user_id = auth.uid()
    )
  );

COMMENT ON POLICY orders_vendor_read_access ON public.orders IS
  'Phase 5: vendors may SELECT only orders that include their shop line items.';

COMMENT ON POLICY order_items_vendor_access ON public.order_items IS
  'Vendors may access only order_items for shops they own (shops.user_id = auth.uid()).';
