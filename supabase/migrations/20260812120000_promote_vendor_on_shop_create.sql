-- Promote shop owners to vendor role atomically when a shop is created.
-- Admins (role = 'A') are never demoted. Idempotent for re-runs.

CREATE OR REPLACE FUNCTION public.promote_shop_owner_to_vendor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET role = 'V',
      updated_at = now()
  WHERE id = NEW.user_id
    AND COALESCE(role, 'U') NOT IN ('A', 'V');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_shop_owner_to_vendor ON public.shops;

CREATE TRIGGER trg_promote_shop_owner_to_vendor
  AFTER INSERT ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_shop_owner_to_vendor();

COMMENT ON FUNCTION public.promote_shop_owner_to_vendor() IS
  'After shop insert, set profiles.role = V for the owner unless already A or V.';
