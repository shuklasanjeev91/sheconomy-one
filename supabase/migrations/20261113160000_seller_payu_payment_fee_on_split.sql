-- Deduct PayU / SHEPay payment processing fee from seller settlements.
-- Gross shop amount stays on `amount`; fee + net seller share are tracked explicitly.
-- Absolute split uses aggregatorSubAmt = seller_amount and aggregatorCharges = payment_fee_amount.

ALTER TABLE public.shepay_pending_settlements
  ADD COLUMN IF NOT EXISTS payment_fee_amount numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (payment_fee_amount >= 0),
  ADD COLUMN IF NOT EXISTS seller_amount numeric(12, 2);

COMMENT ON COLUMN public.shepay_pending_settlements.amount IS
  'Gross shop allocation from the buyer payment (item + shipping/DDP).';

COMMENT ON COLUMN public.shepay_pending_settlements.payment_fee_amount IS
  'PayU / SHEPay payment processing fee withheld as aggregatorCharges (not SHEconomy item commission).';

COMMENT ON COLUMN public.shepay_pending_settlements.seller_amount IS
  'Net amount absolute-split to the child merchant (amount - payment_fee_amount).';

-- Backfill net = gross for rows created before fee deduction.
UPDATE public.shepay_pending_settlements
SET seller_amount = amount
WHERE seller_amount IS NULL;

ALTER TABLE public.shepay_pending_settlements
  ALTER COLUMN seller_amount SET DEFAULT 0;

ALTER TABLE public.shepay_pending_settlements
  ALTER COLUMN seller_amount SET NOT NULL;

ALTER TABLE public.shepay_pending_settlements
  DROP CONSTRAINT IF EXISTS shepay_pending_settlements_seller_amount_check;
ALTER TABLE public.shepay_pending_settlements
  ADD CONSTRAINT shepay_pending_settlements_seller_amount_check
  CHECK (seller_amount >= 0 AND seller_amount <= amount);

ALTER TABLE public.shepay_pending_settlements
  DROP CONSTRAINT IF EXISTS shepay_pending_settlements_fee_plus_seller_check;
ALTER TABLE public.shepay_pending_settlements
  ADD CONSTRAINT shepay_pending_settlements_fee_plus_seller_check
  CHECK (round(payment_fee_amount + seller_amount, 2) = round(amount, 2));

-- Clarify the SHEPay processing fee rule (still 1.5%; applied at payment_split).
UPDATE public.platform_fee_rules
SET label = 'PayU payment fee (deducted from seller payout)'
WHERE id = 'shepay_payment';
