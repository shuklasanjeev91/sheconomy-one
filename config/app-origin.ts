/** Custom URL scheme — opens the native app (sheconomy://path). */
export const APP_SCHEME = 'sheconomy'

/** Default production web origin when env vars are unset. */
export const DEFAULT_APP_ORIGIN = 'https://sheconomy.in'

/**
 * Host used only for incoming Universal Links / App Links. Android Digital
 * Asset Links and Apple AASA are registered on `www` (the apex 308s and
 * those fetchers do not follow redirects). Share sheets and copied links still
 * use `DEFAULT_APP_ORIGIN` (`https://sheconomy.in`).
 */
export const DEEP_LINK_ORIGIN = 'https://www.sheconomy.in'

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
  const hosts = new Set([origin, DEFAULT_APP_ORIGIN, DEEP_LINK_ORIGIN])
  return [`${APP_SCHEME}://`, `${APP_SCHEME}:///`, ...hosts]
}

/**
 * Origin for links that should open the installed app. Brand hosts collapse to
 * the App-Link-verified host; staging / self-hosted origins are left alone.
 */
export function resolveDeepLinkOrigin(): string {
  const origin = resolveAppOrigin()
  try {
    return isBrandAliasHost(new URL(origin).hostname) ? DEEP_LINK_ORIGIN : origin
  } catch {
    return DEEP_LINK_ORIGIN
  }
}

/**
 * Public HTTPS URL for share sheets, OG tags, invites, and copied links.
 * Always the apex production domain — never a Vercel preview host or www.
 */
export function buildAppUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${DEFAULT_APP_ORIGIN}${normalized}`
}

/**
 * Meeting App Links / Universal Links are verified on `www`. Apex `sheconomy.in`
 * 308s to www and association handlers do not follow redirects — sharing the apex
 * link makes the OS open the browser first, then the app. Keep meeting paths on
 * the verified host.
 */
function isMeetingSharePath(pathname: string): boolean {
  const normalized = pathname.replace(/^\/cowork(?=\/|$)/i, '/co-work')
  return /^\/co-work\/meeting(\/|$)/i.test(normalized)
}

function normalizeSharePath(pathname: string, search = '', hash = ''): string {
  const path = pathname.replace(/^\/cowork(?=\/|$)/i, '/co-work')
  return `${path.startsWith('/') ? path : `/${path}`}${search}${hash}`
}

/** Rewrite share URLs onto the public host (strips *.vercel.app). Meeting links stay on www. */
export function toPublicShareUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return DEFAULT_APP_ORIGIN
  if (trimmed.startsWith('sheconomy://')) {
    const path = trimmed.replace(/^sheconomy:\/\//, '').replace(/^\//, '')
    const normalized = normalizeSharePath(`/${path}`)
    const origin = isMeetingSharePath(normalized) ? DEEP_LINK_ORIGIN : DEFAULT_APP_ORIGIN
    return `${origin}${normalized}`
  }
  if (trimmed.startsWith('/')) {
    const normalized = normalizeSharePath(trimmed)
    const origin = isMeetingSharePath(normalized) ? DEEP_LINK_ORIGIN : DEFAULT_APP_ORIGIN
    return `${origin}${normalized}`
  }
  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    const normalized = normalizeSharePath(parsed.pathname, parsed.search, parsed.hash)
    const origin = isMeetingSharePath(parsed.pathname) ? DEEP_LINK_ORIGIN : DEFAULT_APP_ORIGIN
    return `${origin}${normalized}`
  } catch {
    return `${DEFAULT_APP_ORIGIN}/${trimmed.replace(/^\//, '')}`
  }
}

/** Custom-scheme URL for "open in app" buttons from web marketing pages. */
export function buildNativeSchemeUrl(path: string): string {
  const normalized = path.replace(/^\//, '')
  return `${APP_SCHEME}://${normalized}`
}
