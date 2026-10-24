/** Canonical production web origin for emails, push, and invite links. */
export const DEFAULT_PUBLIC_APP_ORIGIN = 'https://www.sheconomy.in'

function isEphemeralHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.now.sh') ||
    host.endsWith('.netlify.app') ||
    host.endsWith('.expo.dev') ||
    host.endsWith('.exp.direct')
  )
}

function isBrandAliasHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host === 'sheconomy.in' ||
    host === 'www.sheconomy.in' ||
    host === 'sheconomy.com' ||
    host === 'www.sheconomy.com'
  )
}

/** Resolve PUBLIC_APP_URL / APP_URL to the canonical www.sheconomy.in origin. */
export function resolvePublicAppOrigin(): string {
  const candidates = [
    Deno.env.get('PUBLIC_APP_URL'),
    Deno.env.get('APP_URL'),
    Deno.env.get('EXPO_PUBLIC_WEB_APP_URL'),
  ]
  for (const value of candidates) {
    if (!value?.trim()) continue
    try {
      const url = new URL(value.includes('://') ? value.trim() : `https://${value.trim()}`)
      if (isEphemeralHost(url.hostname) || isBrandAliasHost(url.hostname)) {
        return DEFAULT_PUBLIC_APP_ORIGIN
      }
      return url.origin
    } catch {
      // try next
    }
  }
  return DEFAULT_PUBLIC_APP_ORIGIN
}

/** Payment return URLs must land on the same origin as checkout (localhost in dev). */
export function resolvePaymentAppOrigin(preferred?: string | null): string {
  const trimmed = String(preferred ?? '').trim()
  if (trimmed) {
    try {
      const url = new URL(trimmed)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        const host = url.hostname.toLowerCase()
        if (isEphemeralHost(host) || isBrandAliasHost(host)) {
          return url.origin
        }
      }
    } catch {
      // fall through
    }
  }
  return resolvePublicAppOrigin()
}

/**
 * Absolute public URL for notifications / emails.
 * Rewrites vercel / sheconomy.com / apex onto https://www.sheconomy.in.
 */
export function toCanonicalPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null

  const origin = resolvePublicAppOrigin()

  if (trimmed.startsWith('sheconomy://')) {
    const path = trimmed.replace(/^sheconomy:\/\//, '').replace(/^\//, '')
    return `${origin}/${path}`
  }
  if (trimmed.startsWith('/')) return `${origin}${trimmed}`

  try {
    const parsed = new URL(trimmed)
    if (isEphemeralHost(parsed.hostname) || isBrandAliasHost(parsed.hostname)) {
      return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`
    }
    return trimmed
  } catch {
    return `${origin}/${trimmed.replace(/^\//, '')}`
  }
}
