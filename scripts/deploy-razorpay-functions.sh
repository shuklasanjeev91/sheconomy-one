#!/bin/bash
# Deploy all Razorpay edge functions to Supabase.
# Run from the project root:  bash scripts/deploy-razorpay-functions.sh

set -e

PROJECT_ID="zsaqrrzwygzwrlzgymxk"
ENV_FILE=".env"

# ── 1. Check for supabase CLI ──────────────────────────────────────────────────
if ! command -v supabase &> /dev/null; then
  echo ""
  echo "  ❌  Supabase CLI not found."
  echo "  Install it first:  brew install supabase/tap/supabase"
  echo "  Then re-run this script."
  exit 1
fi

echo ""
echo "  ✓  Supabase CLI:  $(supabase --version)"
echo ""

# ── 2. Load PAYMENT_ENCRYPTION_KEY from .env ──────────────────────────────────
PAYMENT_KEY=""
if [ -f "$ENV_FILE" ]; then
  PAYMENT_KEY=$(grep -E '^PAYMENT_ENCRYPTION_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')
fi

if [ -z "$PAYMENT_KEY" ]; then
  echo "  ❌  PAYMENT_ENCRYPTION_KEY not found in .env"
  echo "  Generate one with:  openssl rand -hex 32"
  echo "  Add to .env:  PAYMENT_ENCRYPTION_KEY=<64-hex-chars>"
  exit 1
fi

if [ ${#PAYMENT_KEY} -ne 64 ]; then
  echo "  ❌  PAYMENT_ENCRYPTION_KEY must be 64 hex characters (got ${#PAYMENT_KEY})"
  exit 1
fi

echo "  ✓  PAYMENT_ENCRYPTION_KEY found (${#PAYMENT_KEY} chars)"
echo ""

# ── 3. Push the secret to Supabase ────────────────────────────────────────────
echo "  → Setting PAYMENT_ENCRYPTION_KEY secret on Supabase..."
supabase secrets set PAYMENT_ENCRYPTION_KEY="$PAYMENT_KEY" --project-ref "$PROJECT_ID"
echo "  ✓  Secret set"
echo ""

# ── 4. Deploy functions ───────────────────────────────────────────────────────
FUNCTIONS=(
  "razorpay-validate"
  "razorpay-connect"
  "razorpay-disconnect"
  "razorpay-create-order"
  "razorpay-verify-payment"
  "razorpay-direct-create"
  "razorpay-direct-webhook"
)

for fn in "${FUNCTIONS[@]}"; do
  echo "  → Deploying $fn..."
  supabase functions deploy "$fn" --project-ref "$PROJECT_ID" --no-verify-jwt 2>&1 | tail -3
  echo "  ✓  $fn deployed"
  echo ""
done

echo "  ✅  All Razorpay functions deployed successfully!"
echo ""
echo "  Function URLs:"
for fn in "${FUNCTIONS[@]}"; do
  echo "    https://${PROJECT_ID}.supabase.co/functions/v1/$fn"
done
echo ""
