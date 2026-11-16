-- Per-shop EasyShip child company (PayU-child analogue).
-- Sellers fund EasyShip credit on their child company via SHEconomy;
-- platform MOR no longer needs to float carrier balance once partner/enterprise is live.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS easyship_company_id text,
  ADD COLUMN IF NOT EXISTS easyship_payment_source_id text,
  ADD COLUMN IF NOT EXISTS easyship_linked_at timestamptz;

COMMENT ON COLUMN public.shops.easyship_company_id IS
  'EasyShip child company id (e.g. CIN…) created under the SHEconomy partner org; rates/labels/credit use X-EASYSHIP-COMPANY-ID.';
COMMENT ON COLUMN public.shops.easyship_payment_source_id IS
  'Default EasyShip payment source on the child company for POST /account/credit top-ups from Vendor Wallet.';
COMMENT ON COLUMN public.shops.easyship_linked_at IS
  'When the EasyShip child company was created/linked for this shop.';

CREATE UNIQUE INDEX IF NOT EXISTS shops_easyship_company_id_uidx
  ON public.shops (easyship_company_id)
  WHERE easyship_company_id IS NOT NULL;
