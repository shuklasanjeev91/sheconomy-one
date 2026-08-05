/**
 * PayU merchant-hosted checkout helpers.
 * Bridge page auto-POSTs fields to PayU `_payment`; return URLs land on `/orders/payu-return`.
 */

export type PayuBridgeSession = {
  action: string
  fields: Record<string, string>
  createdAt: number
}

/** In-memory handoff so native navigation does not depend on huge query strings. */
let pendingPayuBridgeSession: PayuBridgeSession | null = null

export function savePayuBridgeSession(action: string, fields: Record<string, string>): void {
  pendingPayuBridgeSession = { action, fields, createdAt: Date.now() }
}

export function consumePayuBridgeSession(maxAgeMs = 15 * 60 * 1000): PayuBridgeSession | null {
  const session = pendingPayuBridgeSession
  pendingPayuBridgeSession = null
  if (!session) return null
  if (Date.now() - session.createdAt > maxAgeMs) return null
  return session
}

export function peekPayuBridgeSession(): PayuBridgeSession | null {
  return pendingPayuBridgeSession
}

/** Normalize One/router search param values (string | string[]). */
export function firstSearchParam(value: string | string[] | undefined | null): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return typeof value === 'string' ? value : ''
}

/** Parse bridge query params; tolerates URI encoding quirks. */
export function parsePayuBridgeParams(actionRaw: string, payloadRaw: string): {
  action: string
  fields: Record<string, string> | null
  error: string | null
} {
  const action = actionRaw.trim()
  let raw = payloadRaw.trim()
  if (!action || !raw) {
    return { action: '', fields: null, error: 'Missing payment payload' }
  }
  try {
    if (raw.includes('%')) {
      try {
        raw = decodeURIComponent(raw)
      } catch {
        // keep raw
      }
    }
    const parsed = JSON.parse(raw) as Record<string, string>
    if (!parsed || typeof parsed !== 'object') {
      return { action: '', fields: null, error: 'Invalid payment payload' }
    }
    return { action, fields: parsed, error: null }
  } catch {
    return { action: '', fields: null, error: 'Invalid payment payload' }
  }
}

/** Build HTML that auto-submits a POST form (used by native WebView). */
export function buildPayuAutoSubmitHtml(action: string, fields: Record<string, string>): string {
  const escapeAttr = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeAttr(name)}" value="${escapeAttr(String(value ?? ''))}" />`,
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Redirecting to payment</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; color: #444; background: #fafafa; }
  </style>
</head>
<body>
  <p>Redirecting to secure payment…</p>
  <form id="payu" method="POST" action="${escapeAttr(action)}">${inputs}</form>
  <script>document.getElementById('payu').submit();</script>
</body>
</html>`
}

/** True when a navigation URL is our PayU surl/furl landing (in-app or absolute). */
export function isPayuReturnUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url, 'https://sheconomy.local')
    return /\/orders\/payu-return\/?$/.test(parsed.pathname)
  } catch {
    return /\/orders\/payu-return(\?|$)/.test(url)
  }
}

/** Extract success/failure status from a PayU return URL. */
export function payuReturnStatusFromUrl(url: string): 'success' | 'failure' {
  try {
    const parsed = new URL(url, 'https://sheconomy.local')
    const status = (parsed.searchParams.get('status') ?? '').toLowerCase()
    return status === 'success' ? 'success' : 'failure'
  } catch {
    return /[?&]status=success\b/i.test(url) ? 'success' : 'failure'
  }
}

export function payuReturnHref(status: 'success' | 'failure'): string {
  return `/orders/payu-return?status=${status}`
}
