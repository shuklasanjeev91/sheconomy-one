-- Seller-owned warehouses: RLS so shop owners can manage ship-from addresses.
-- EasyShip resolveSellerOrigin prefers warehouses over shops.shop_address_id.

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warehouses_owner_select ON public.warehouses;
CREATE POLICY warehouses_owner_select
  ON public.warehouses
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

DROP POLICY IF EXISTS warehouses_owner_insert ON public.warehouses;
CREATE POLICY warehouses_owner_insert
  ON public.warehouses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS warehouses_owner_update ON public.warehouses;
CREATE POLICY warehouses_owner_update
  ON public.warehouses
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

COMMENT ON TABLE public.warehouses IS
  'Seller ship-from / fulfillment warehouses. Default active row is preferred EasyShip origin.';
