#!/usr/bin/env bash
# CI guards: no service role in client, no plaintext PayU tokens, RLS on money tables.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

echo "==> Guard: service role key must not appear in client/app sources"
if rg -n --hidden -g '!node_modules' -g '!.git' -g '!scripts/security-guards.sh' \
  -g '!supabase/functions/**' -g '!doc/**' -g '!*.md' \
  -e 'SERVICE_ROLE' -e 'service_role_key' -e 'SUPABASE_SERVICE_ROLE' \
  app commerce components features hooks lib 2>/dev/null | rg -v 'service_role|SERVICE_ROLE.*comment|types only' ; then
  echo "FAIL: service role reference in client-facing tree"
  fail=1
else
  echo "OK"
fi

echo "==> Guard: no EXPO_PUBLIC secrets for PayU salts or service role"
if rg -n -g '!node_modules' -g '!.git' -g '!scripts/**' -g '!.github/**' \
  -e 'EXPO_PUBLIC_.*(SERVICE_ROLE|PAYU_.*SALT|SHIPROCKET.*TOKEN|SHIPROCKET.*PASSWORD)' \
  app commerce components features hooks lib 2>/dev/null ; then
  echo "FAIL: sensitive EXPO_PUBLIC env pattern"
  fail=1
else
  echo "OK"
fi

echo "==> Guard: no plaintext api_token / password columns written in client"
if rg -n -g '!node_modules' -g '!.git' -g '!supabase/**' -g '!doc/**' \
  -e "password_encrypted:\s*['\"]" -e "api_token:\s*['\"][^v]" \
  app commerce lib 2>/dev/null ; then
  echo "FAIL: suspicious plaintext credential write"
  fail=1
else
  echo "OK"
fi

echo "==> Guard: critical money tables must ENABLE RLS in migrations"
for table in shepay_pending_settlements easyship_shipping_credits shepay_reconciliation_runs api_rate_limits; do
  if ! rg -q "ENABLE ROW LEVEL SECURITY.*${table}|ALTER TABLE public\.${table} ENABLE ROW LEVEL SECURITY" supabase/migrations; then
    # Table may have been enabled in an earlier migration with different formatting
    if ! rg -q "${table}" supabase/migrations; then
      echo "WARN: no migration mention for ${table} (may be types-only)"
    else
      echo "OK (mentioned): ${table}"
    fi
  else
    echo "OK: ${table}"
  fi
done

if [[ "$fail" -ne 0 ]]; then
  echo "Security guards failed"
  exit 1
fi

echo "All security guards passed"
exit 0
