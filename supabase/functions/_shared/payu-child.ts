/**
 * Resolve PayU Automate child merchant credentials from shop_payment_accounts.metadata.
 */

export function childFromAccountMetadata(meta: Record<string, unknown>): {
  merchantKey: string
  childMid: string
} | null {
  const childKey =
    typeof meta.child_merchant_key === 'string'
      ? meta.child_merchant_key.trim()
      : typeof meta.merchant_key === 'string' && meta.onboarded_via === 'sheconomy'
        ? String(meta.merchant_key).trim()
        : ''
  if (!childKey) return null
  const childMid =
    typeof meta.child_mid === 'string' && meta.child_mid.trim()
      ? meta.child_mid.trim()
      : ''
  // Child MID is required for release_settlement (var2).
  if (!childMid) return null
  return { merchantKey: childKey, childMid }
}
