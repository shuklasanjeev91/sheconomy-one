-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies for order_issues
--
-- Context: RLS is already enabled on order_issues but no policies exist, so
-- every INSERT/SELECT/UPDATE is blocked for authenticated users.
--
-- Actors and their needs:
--   Customer  — creates cancellation/support issues for their own orders,
--               reads back their own issues
--   Vendor    — reads issues raised against their shop's order items
--   Admin     — full access to all issues across the platform
--
-- Run this in Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Admin — unrestricted access (checked first so admins are never blocked)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admins_all_order_issues"
  ON public.order_issues
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'A'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'A'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Customer INSERT — create an issue for an order they own.
--    The service always sets reported_by = auth.uid(), so we enforce both:
--      • reported_by  = the caller
--      • order_id     belongs to the caller
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "customer_insert_order_issue"
  ON public.order_issues
  FOR INSERT
  WITH CHECK (
    reported_by = auth.uid()
    AND order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Customer SELECT — read issues they reported OR issues on their orders.
--    (Both columns handle different query shapes used in the service.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "customer_select_own_issues"
  ON public.order_issues
  FOR SELECT
  USING (
    reported_by = auth.uid()
    OR order_id IN (
      SELECT id FROM public.orders WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Vendor SELECT — read issues raised against their shop's items.
--    order_item_id may be NULL for order-level issues; we fall back to
--    checking whether any item on the order belongs to the vendor's shop.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "vendor_select_shop_issues"
  ON public.order_issues
  FOR SELECT
  USING (
    order_id IN (
      SELECT DISTINCT oi.order_id
      FROM public.order_items oi
      JOIN public.shops s ON oi.vendor_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Customer UPDATE — allow the reporter to update their own open issues
--    (e.g. add evidence, edit description before it is resolved).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "customer_update_own_issue"
  ON public.order_issues
  FOR UPDATE
  USING (reported_by = auth.uid())
  WITH CHECK (reported_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Vendor UPDATE — allow vendors to update issue status / add resolution
--    notes on issues that belong to their shop's orders.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "vendor_update_shop_issues"
  ON public.order_issues
  FOR UPDATE
  USING (
    order_id IN (
      SELECT DISTINCT oi.order_id
      FROM public.order_items oi
      JOIN public.shops s ON oi.vendor_id = s.id
      WHERE s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT DISTINCT oi.order_id
      FROM public.order_items oi
      JOIN public.shops s ON oi.vendor_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );
