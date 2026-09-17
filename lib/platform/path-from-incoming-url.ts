import {
  APP_SCHEME,
  DEFAULT_APP_ORIGIN,
  resolveAppOrigin,
} from '~/config/app-origin'

function isBrandHttpsHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return (
    host === 'sheconomy.in' ||
    host === 'www.sheconomy.in' ||
    host === 'sheconomy.com' ||
    host === 'www.sheconomy.com'
  )
}

function normalizeMeetingAlias(path: string): string {
  return path.replace(/^\/cowork(?=\/|$)/i, '/co-work')
}

/** Parse an incoming deep link / universal link into an in-app path. */
export function pathFromIncomingUrl(url: string): string | null {
  if (!url) return null

  if (url.startsWith(`${APP_SCHEME}://`)) {
    const rest = url.slice(`${APP_SCHEME}://`.length)
    const path = rest.startsWith('/') ? rest : `/${rest}`
    return normalizeMeetingAlias(path || '/')
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

    const origin = resolveAppOrigin()
    const expectedHost = new URL(origin).host
    if (parsed.host === expectedHost || isBrandHttpsHost(parsed.hostname)) {
      return normalizeMeetingAlias(`${parsed.pathname}${parsed.search}` || '/')
    }

    if (url.startsWith(origin)) {
      return normalizeMeetingAlias(url.slice(origin.length) || '/')
    }
    if (url.startsWith(DEFAULT_APP_ORIGIN)) {
      return normalizeMeetingAlias(url.slice(DEFAULT_APP_ORIGIN.length) || '/')
    }
  } catch {
    return null
  }

  return null
}
