/** Custom URL scheme — opens the native app (sheconomy://path). */
export const APP_SCHEME = 'sheconomy'

/** Default production web origin when env vars are unset. */
export const DEFAULT_APP_ORIGIN = 'https://sheconomy.in'

/** Preview / deploy hosts that must never appear in share or deep links. */
function isEphemeralOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase()
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
  } catch {
    return true
  }
}

function normalizeOrigin(value: string): string | undefined {
  const trimmed = value.trim().replace(/\/$/, '')
  if (!trimmed) return undefined
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    const origin = url.origin
    if (isEphemeralOrigin(origin)) return undefined
    return origin
  } catch {
    return undefined
  }
}

function readEnvOrigin(): string | undefined {
  const candidates = [
    typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_WEB_APP_URL : undefined,
    typeof process !== 'undefined' ? process.env.ONE_SERVER_URL : undefined,
  ]

  for (const value of candidates) {
    if (value && typeof value === 'string') {
      const origin = normalizeOrigin(value)
      if (origin) return origin
    }
  }

  return undefined
}

/** Canonical HTTPS origin for web + native (share links, WebViews, API callbacks). */
export function resolveAppOrigin(): string {
  return readEnvOrigin() ?? DEFAULT_APP_ORIGIN
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
