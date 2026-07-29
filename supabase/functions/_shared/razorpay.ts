const encoder = new TextEncoder()

export type RazorpayCredentials = {
  key_id: string
  key_secret: string
  webhook_secret?: string | null
}

export function razorpayAuthHeader(credentials: RazorpayCredentials): string {
  const token = btoa(`${credentials.key_id}:${credentials.key_secret}`)
  return `Basic ${token}`
}

/**
 * Parse credentials from the legacy format where credentials were stored as a
 * plain JSON string in `metadata.credentials`.
 *
 * New accounts use AES-256-GCM encryption; their `access_token` holds the
 * encrypted key_secret and `metadata.iv` / `metadata.auth_tag` hold the
 * decryption parameters. Those must be decrypted server-side via
 * `supabase/functions/_shared/encryption.ts`. This function is only used for
 * the legacy plain-text format.
 */
export function parseStoredCredentials(raw: unknown): RazorpayCredentials | null {
  if (!raw || typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const keyId = typeof parsed.key_id === 'string' ? parsed.key_id.trim() : ''
    const keySecret = typeof parsed.key_secret === 'string' ? parsed.key_secret.trim() : ''
    if (!keyId || !keySecret) return null
    return {
      key_id: keyId,
      key_secret: keySecret,
      webhook_secret:
        typeof parsed.webhook_secret === 'string' ? parsed.webhook_secret.trim() : null,
    }
  } catch {
    return null
  }
}

/**
 * Check whether a shop_payment_accounts row was saved with the new encrypted format.
 * Encrypted rows have `metadata.iv` and `metadata.auth_tag` instead of `metadata.credentials`.
 */
export function isEncryptedAccount(metadata: Record<string, unknown> | null | undefined): boolean {
  return (
    typeof metadata?.iv === 'string' &&
    typeof metadata?.auth_tag === 'string'
  )
}

export function amountToPaise(amount: number): number {
  return Math.max(0, Math.round(amount * 100))
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

/** Verify Razorpay webhook `X-Razorpay-Signature` (HMAC SHA256 of raw body). */
export async function verifyRazorpayWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return timingSafeEqual(bytesToHex(digest), signature.trim())
}

export async function createRazorpayPaymentLink(
  credentials: RazorpayCredentials,
  input: {
    amountPaise: number
    currency: string
    referenceId: string
    description: string
    customerName: string
    customerEmail: string
    callbackUrl: string
    notes: Record<string, string>
  },
): Promise<{ short_url: string; id: string }> {
  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: razorpayAuthHeader(credentials),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      accept_partial: false,
      reference_id: input.referenceId,
      description: input.description,
      customer: {
        name: input.customerName,
        email: input.customerEmail,
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      callback_url: input.callbackUrl,
      callback_method: 'get',
      notes: input.notes,
    }),
  })

  const payload = (await response.json()) as {
    error?: { description?: string; code?: string }
    short_url?: string
    id?: string
  }

  if (!response.ok || !payload.short_url || !payload.id) {
    const message =
      payload.error?.description ??
      payload.error?.code ??
      `Razorpay payment link failed (${response.status})`
    throw new Error(message)
  }

  return { short_url: payload.short_url, id: payload.id }
}
