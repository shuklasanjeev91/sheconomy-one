-- 0% commission / seller-direct charges:
-- SHEconomy does not retain buyer freight or auto-fund seller shipping ledgers.
-- Sellers fund easyship_shipping_credits themselves; labels debit that wallet only.

DROP TRIGGER IF EXISTS trg_easyship_credit_on_payment_completed ON public.order_payments;
DROP TRIGGER IF EXISTS trg_easyship_credit_on_order_paid ON public.orders;

CREATE OR REPLACE FUNCTION public.trg_easyship_credit_on_payment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No-op: buyer shipping settles to the seller via PayU absolute split (0% platform cut).
  -- Sellers top up easyship_shipping_credits; label purchase debits their wallet.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_easyship_credit_on_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.easyship_credit_shipping_from_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kept for backward-compatible callers; intentionally does not credit the seller ledger.
  RETURN jsonb_build_object(
    'ok', true,
    'skipped', true,
    'reason', 'seller_direct_charges',
    'order_id', p_order_id
  );
END;
$$;

COMMENT ON FUNCTION public.easyship_credit_shipping_from_order(uuid) IS
  'No-op under 0% commission seller-direct model. Sellers self-fund easyship_shipping_credits.';

COMMENT ON TABLE public.easyship_shipping_credits IS
  'Per-shop prepaid shipping wallet. Sellers fund this; label buys debit it. SHEconomy takes 0% commission and does not auto-credit from buyer remittance.';
