import { Linking, Platform } from 'react-native'

import { normalizePayuIntentUri, type PayuPaymentModeId } from '~/commerce/lib/payu-payment-modes'

/**
 * Web desktop cannot open GPay/PhonePe intents — PayU mandates QR for web.
 * Native Android/iOS should open the UPI app (Smart Intent / deeplink).
 */
export function payuUpiShouldShowQr(modeId: PayuPaymentModeId): boolean {
  if (Platform.OS === 'web') return true
  return modeId === 'upi_qr'
}

/** Prefer app-specific schemes on native when PayU returned a generic upi:// link. */
export function payuUpiLaunchCandidates(
  intentUri: string,
  modeId: PayuPaymentModeId,
): string[] {
  const base = normalizePayuIntentUri(intentUri)
  if (!base) return []

  const query = base.includes('?') ? base.slice(base.indexOf('?') + 1) : ''
  const out: string[] = []

  if (modeId === 'upi_gpay') {
    if (query) {
      out.push(`tez://upi/pay?${query}`)
      out.push(`gpay://upi/pay?${query}`)
    }
  }
  if (modeId === 'upi_phonepe') {
    if (query) out.push(`phonepe://pay?${query}`)
  }
  if (modeId === 'upi_paytm') {
    if (query) out.push(`paytmmp://pay?${query}`)
  }

  out.push(base)
  return [...new Set(out)]
}

/** Open UPI app on native; no-op on web (caller shows QR). */
export async function launchPayuUpiIntent(
  intentUri: string,
  modeId: PayuPaymentModeId,
): Promise<boolean> {
  if (Platform.OS === 'web') return false
  const candidates = payuUpiLaunchCandidates(intentUri, modeId)
  for (const url of candidates) {
    try {
      // iOS canOpenURL often returns false without schemes; still attempt open.
      if (Platform.OS === 'ios') {
        await Linking.openURL(url)
        return true
      }
      const can = await Linking.canOpenURL(url)
      if (!can) continue
      await Linking.openURL(url)
      return true
    } catch {
      // try next scheme
    }
  }
  try {
    const fallback = candidates[0] ?? intentUri
    await Linking.openURL(fallback)
    return true
  } catch {
    return false
  }
}
