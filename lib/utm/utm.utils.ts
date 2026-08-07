import { Platform } from 'react-native'

export type UtmData = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  gclid?: string
  gad_source?: string
}

const UTM_STORAGE_KEY = 'utm_data'
const UTM_TIMESTAMP_KEY = 'utm_data_ts'
const LANDING_URL_KEY = 'landing_url'
const LANDING_URL_TIMESTAMP_KEY = 'landing_url_ts'

/** 30 days in milliseconds */
const UTM_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

const META_SOURCES = new Set(['ig', 'an', 'fb', 'facebook', 'instagram'])

/** Normalize Meta variant source labels (ig/an/fb/facebook/instagram) → "meta". */
export function normalizeUtmSource(source: string | undefined): string | undefined {
  if (!source) return source
  return META_SOURCES.has(source.toLowerCase()) ? 'meta' : source
}

/**
 * Parse URL params, synthesize Google Ads utm_* when gclid/gad_source are
 * present, normalize Meta sources, and persist to sessionStorage + localStorage.
 *
 * Must be called before the ApplicationForm mounts (layout useEffect).
 * No-ops on native (no Web Storage API).
 */
export function captureUtmFromUrl(): void {
  if (Platform.OS !== 'web') return
  try {
    const params = new URLSearchParams(window.location.search)

    const raw: UtmData = {
      utm_source: params.get('utm_source') ?? undefined,
      utm_medium: params.get('utm_medium') ?? undefined,
      utm_campaign: params.get('utm_campaign') ?? undefined,
      utm_term: params.get('utm_term') ?? undefined,
      utm_content: params.get('utm_content') ?? undefined,
    }

    // Google Ads: gclid / gad_source → synthesize utm_* fields
    const gclid = params.get('gclid')
    const gadSource = params.get('gad_source')
    const gadCampaign = params.get('gad_campaignid')
    if ((gclid || gadSource) && !raw.utm_source) {
      raw.utm_source = 'google'
      raw.utm_medium = raw.utm_medium ?? 'cpc'
      raw.utm_campaign = raw.utm_campaign ?? gadCampaign ?? 'google_ads'
      if (gclid) raw.gclid = gclid
      if (gadSource) raw.gad_source = gadSource
    }

    // Normalize Meta source variants
    if (raw.utm_source) raw.utm_source = normalizeUtmSource(raw.utm_source)

    // Drop empty / whitespace-only values
    const filtered = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v && String(v).trim()),
    ) as UtmData

    if (Object.keys(filtered).length > 0) {
      saveUtmToStorage(filtered)
    }

    // Always capture full landing URL; a URL with tracking params overwrites
    // a previously stored bare URL (richer source wins).
    const fullUrl = window.location.href
    const hasTracking = /[?&](utm_|fbclid|gclid|gad_)/.test(fullUrl)
    const existing = localStorage.getItem(LANDING_URL_KEY)
    if (!existing || hasTracking) {
      localStorage.setItem(LANDING_URL_KEY, fullUrl)
      localStorage.setItem(LANDING_URL_TIMESTAMP_KEY, Date.now().toString())
    }
  } catch (e) {
    console.warn('[UtmCapture] error:', e)
  }
}

/** Persist UTM data to sessionStorage (fast same-tab) + localStorage (survives in-app browser switch). */
export function saveUtmToStorage(data: UtmData): void {
  if (Platform.OS !== 'web') return
  try {
    const json = JSON.stringify(data)
    sessionStorage.setItem(UTM_STORAGE_KEY, json)
    localStorage.setItem(UTM_STORAGE_KEY, json)
    localStorage.setItem(UTM_TIMESTAMP_KEY, Date.now().toString())
  } catch (e) {
    console.warn('[utm] save failed:', e)
  }
}

/**
 * Read UTM data with fallback priority:
 * 1. Current URL params (freshest — handles ad re-clicks)
 * 2. sessionStorage
 * 3. localStorage (honoured up to 30 days)
 */
export function readUtmFromStorage(): UtmData {
  if (Platform.OS !== 'web') return {}
  try {
    const params = new URLSearchParams(window.location.search)
    const fromUrl: UtmData = {}
    const UTM_FIELDS = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
    ] as const
    for (const k of UTM_FIELDS) {
      const v = params.get(k)
      if (v?.trim()) fromUrl[k] = v.trim()
    }
    const gclid = params.get('gclid')
    const gadSource = params.get('gad_source')
    const gadCampaign = params.get('gad_campaignid')
    if ((gclid || gadSource) && !fromUrl.utm_source) {
      fromUrl.utm_source = 'google'
      fromUrl.utm_medium = fromUrl.utm_medium ?? 'cpc'
      fromUrl.utm_campaign = fromUrl.utm_campaign ?? gadCampaign ?? 'google_ads'
      if (gclid) fromUrl.gclid = gclid
      if (gadSource) fromUrl.gad_source = gadSource
    }
    if (fromUrl.utm_source) fromUrl.utm_source = normalizeUtmSource(fromUrl.utm_source)
    if (Object.keys(fromUrl).length > 0) return fromUrl

    const sess = sessionStorage.getItem(UTM_STORAGE_KEY)
    if (sess) return JSON.parse(sess) as UtmData

    const local = localStorage.getItem(UTM_STORAGE_KEY)
    const ts = localStorage.getItem(UTM_TIMESTAMP_KEY)
    if (local && ts && Date.now() - parseInt(ts, 10) < UTM_MAX_AGE_MS) {
      return JSON.parse(local) as UtmData
    }
  } catch (e) {
    console.warn('[utm] read failed:', e)
  }
  return {}
}

/** Remove UTM data from both storages — call after the seller account is created. */
export function clearUtmFromStorage(): void {
  if (Platform.OS !== 'web') return
  try {
    sessionStorage.removeItem(UTM_STORAGE_KEY)
    localStorage.removeItem(UTM_STORAGE_KEY)
    localStorage.removeItem(UTM_TIMESTAMP_KEY)
  } catch {}
}

/**
 * Read the raw landing URL persisted by `captureUtmFromUrl`.
 * Returns `null` when absent or older than 30 days.
 */
export function readLandingUrlFromStorage(): string | null {
  if (Platform.OS !== 'web') return null
  try {
    const url = localStorage.getItem(LANDING_URL_KEY)
    const ts = localStorage.getItem(LANDING_URL_TIMESTAMP_KEY)
    if (url && ts && Date.now() - parseInt(ts, 10) < UTM_MAX_AGE_MS) return url
  } catch {}
  return null
}

/** Remove landing URL from storage — call after it has been persisted to the profile. */
export function clearLandingUrlFromStorage(): void {
  if (Platform.OS !== 'web') return
  try {
    localStorage.removeItem(LANDING_URL_KEY)
    localStorage.removeItem(LANDING_URL_TIMESTAMP_KEY)
  } catch {}
}
