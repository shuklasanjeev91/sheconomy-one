/** Browser-side PayU form POST helper for Platform PayU checkout. */

export { submitPayuFormPost as submitPlatformPayuForm } from '~/commerce/lib/payu-bridge'

export function firstQueryParam(value: string | string[] | undefined | null): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return typeof value === 'string' ? value : ''
}

export function platformPayuFailureMessage(reason: string | null | undefined): string {
  const raw = String(reason ?? '').trim()
  if (!raw) return 'Your payment could not be completed.'
  if (raw.toLowerCase() === 'tampered') {
    return 'Payment verification failed. Please try again or contact support.'
  }
  return raw
}
