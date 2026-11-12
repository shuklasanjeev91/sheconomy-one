-- Remove seller-owned Shiprocket connect product (config, rate cache, vault tokens).
-- Keep order_delivery.shiprocket_order_id for historical AWBs.
-- SheDelivery platform returns/tracking still use env SHIPROCKET_EMAIL/PASSWORD.

DROP TABLE IF EXISTS public.shiprocket_rate_cache CASCADE;
DROP TABLE IF EXISTS public.shiprocket_webhook_events CASCADE;

DROP FUNCTION IF EXISTS public.shiprocket_store_api_token(uuid, text);
DROP FUNCTION IF EXISTS public.shiprocket_get_api_token(uuid);
DROP FUNCTION IF EXISTS public.shiprocket_clear_api_token(uuid);

-- Best-effort: remove vault secrets named shiprocket_token_{shop_id}
DO $$
BEGIN
  IF to_regclass('vault.secrets') IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM vault.secrets WHERE name LIKE 'shiprocket_token_%';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'vault shiprocket token cleanup skipped: %', SQLERRM;
END;
$$;

DROP TABLE IF EXISTS public.shiprocket_config CASCADE;

DELETE FROM public.shipping_providers
WHERE provider_type = 'shiprocket';

UPDATE public.notification_templates
SET is_active = false, updated_at = now()
WHERE template_key IN ('shiprocket_wallet_low_seller')
  AND is_active = true;
