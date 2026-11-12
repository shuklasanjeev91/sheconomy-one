-- SheDelivery (platform Shiprocket wrapper) removed from app + edge functions.
-- No dedicated public tables to drop. Historical order_delivery rows may still
-- reference courier_slug shiprocket/pickrr; tracking falls back to public URLs
-- / AfterShip / TrackingMore (see courier-track-sync).
--
-- Ops: Edge/Vault Shiprocket & SheDelivery secrets removed (none present on
-- production as of 2026-10-30; unset is a no-op if already gone).

SELECT 1;
