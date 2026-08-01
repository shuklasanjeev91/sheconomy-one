/** Custom URL scheme — opens the native app (sheconomy://path). */
export const APP_SCHEME = 'sheconomy'

/** Default production web origin when env vars are unset. */
export const DEFAULT_APP_ORIGIN = 'https://sheconomy.in'

/** Preview / deploy hosts that must never appear in share or deep links. */
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

/**
 * Known brand hosts that must always surface as the apex production domain.
 * Covers legacy sheconomy.com links and www variants.
 */
function isBrandAliasHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host === 'sheconomy.in' ||
    host === 'www.sheconomy.in' ||
    host === 'sheconomy.com' ||
    host === 'www.sheconomy.com'
  )
}

function parseOrigin(value: string): string | undefined {
  const trimmed = value.trim().replace(/\/$/, '')
  if (!trimmed) return undefined
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.origin
  } catch {
    return undefined
  }
}

/**
 * Normalize a candidate origin for public share / notification / deep links.
 * Ephemeral hosts (*.vercel.app, localhost, …) and brand aliases collapse to
 * https://sheconomy.in. Unknown non-ephemeral origins are kept (staging).
 */
export function normalizeAppOrigin(value?: string | null): string {
  if (!value) return DEFAULT_APP_ORIGIN
  const origin = parseOrigin(value)
  if (!origin) return DEFAULT_APP_ORIGIN
  try {
    const host = new URL(origin).hostname
    if (isEphemeralHost(host) || isBrandAliasHost(host)) {
      return DEFAULT_APP_ORIGIN
    }
    return origin
  } catch {
    return DEFAULT_APP_ORIGIN
  }
}

function readEnvOrigin(): string | undefined {
  const candidates = [
    typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_WEB_APP_URL : undefined,
    typeof process !== 'undefined' ? process.env.ONE_SERVER_URL : undefined,
  ]

  for (const value of candidates) {
    if (!value || typeof value !== 'string') continue
    const origin = parseOrigin(value)
    if (!origin) continue
    try {
      const host = new URL(origin).hostname
      if (isEphemeralHost(host)) continue
      if (isBrandAliasHost(host)) return DEFAULT_APP_ORIGIN
      return origin
    } catch {
      continue
    }
  }

  return undefined
}

/** Canonical HTTPS origin for web + native (share links, WebViews, API callbacks). */
export function resolveAppOrigin(): string {
  return readEnvOrigin() ?? DEFAULT_APP_ORIGIN
}

/**
 * Rewrite an absolute URL onto the canonical public origin when the host is
 * ephemeral (Vercel preview) or a brand alias (sheconomy.com / www).
 * Relative paths are left unchanged.
 */
export function canonicalizePublicUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('/') || trimmed.startsWith('sheconomy://')) return trimmed
  try {
    const parsed = new URL(trimmed)
    if (isEphemeralHost(parsed.hostname) || isBrandAliasHost(parsed.hostname)) {
      return `${DEFAULT_APP_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`
    }
    return trimmed
  } catch {
    return trimmed
  }
}

export function getAppHost(): string {
  try {
    return new URL(resolveAppOrigin()).host
  } catch {
    return new URL(DEFAULT_APP_ORIGIN).host
  }
}

/** Prefixes One Router uses to map incoming URLs to in-app routes. */
export function getAppLinkingPrefixes(origin = resolveAppOrigin()): string[] {
  return [`${APP_SCHEME}://`, `${APP_SCHEME}:///`, origin]
}

/** Deep link into the native app, or HTTPS path on web. */
export function buildAppUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${resolveAppOrigin()}${normalized}`
}

/** Custom-scheme URL for "open in app" buttons from web marketing pages. */
export function buildNativeSchemeUrl(path: string): string {
  const normalized = path.replace(/^\//, '')
  return `${APP_SCHEME}://${normalized}`
}
