import type { Tables } from '~/lib/supabase'

export const PAGE_SIZE = 15
export const AUTO_REFRESH_SECONDS = 30

export type ProfileLead = Tables<'profiles'>
export type ShopRow = Tables<'shops'>
export type JourneyStatus = 'seller' | 'face_verified' | 'verified' | 'otp_only'
export type DateRangePreset =
  | 'all'
  | 'today'
  | '7days'
  | '30days'
  | '90days'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom'

export type LeadWithJourney = ProfileLead & { journeyStatus: JourneyStatus }

export type LeadStats = {
  total: number
  completed: number
  otpOnly: number
  faceVerified: number
  sources: Record<string, number>
}

export type DeviceInfo = Record<string, unknown>

export function parseDeviceInfo(lead: Pick<ProfileLead, 'device_info'>): DeviceInfo {
  if (!lead.device_info) return {}
  if (typeof lead.device_info === 'object' && !Array.isArray(lead.device_info)) {
    return lead.device_info as DeviceInfo
  }
  if (typeof lead.device_info === 'string') {
    try {
      return JSON.parse(lead.device_info) as DeviceInfo
    } catch {
      return {}
    }
  }
  return {}
}

export function parseLocalDate(value: string, endOfDay = false): Date | null {
  if (!value) return null
  const parts = value.split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null

  let year: number
  let month: number
  let day: number

  if (parts[0]! > 999) {
    ;[year, month, day] = parts as [number, number, number]
  } else if (parts[2]! > 999) {
    ;[day, month, year] = parts as [number, number, number]
  } else {
    return null
  }

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  if (endOfDay) date.setHours(23, 59, 59, 999)
  else date.setHours(0, 0, 0, 0)
  return date
}

export function isDateWithinRange(timestamp: string | null, from: Date | null, to: Date | null) {
  if (!timestamp) return false
  const value = new Date(timestamp)
  if (Number.isNaN(value.getTime())) return false
  if (from && value < from) return false
  if (to && value > to) return false
  return true
}

export function getValidTimestamp(...values: unknown[]): Date | null {
  for (const value of values) {
    if (!value || typeof value !== 'string') continue
    const ts = new Date(value)
    if (!Number.isNaN(ts.getTime())) return ts
  }
  return null
}

export function getLeadEventTimestamp(lead: ProfileLead): string | null {
  const di = parseDeviceInfo(lead)
  const deviceEventTs = getValidTimestamp(
    di.signed_up_at,
    di.face_verified_at,
    di.landing_url_saved_at,
  )
  const fallbackTs = getValidTimestamp(lead.created_at)
  return (deviceEventTs || fallbackTs)?.toISOString() || null
}

export function getDateRangeBounds(
  preset: DateRangePreset,
  startDate: string,
  endDate: string,
): { from: Date | null; to: Date | null } {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      return { from: start, to: end }
    case '7days':
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      return { from: start, to: end }
    case '30days':
      start.setDate(start.getDate() - 30)
      start.setHours(0, 0, 0, 0)
      return { from: start, to: end }
    case '90days':
      start.setDate(start.getDate() - 90)
      start.setHours(0, 0, 0, 0)
      return { from: start, to: end }
    case 'thisMonth': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      monthStart.setHours(0, 0, 0, 0)
      return { from: monthStart, to: end }
    }
    case 'lastMonth': {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      monthStart.setHours(0, 0, 0, 0)
      monthEnd.setHours(23, 59, 59, 999)
      return { from: monthStart, to: monthEnd }
    }
    case 'custom': {
      const from = parseLocalDate(startDate, false)
      const to = parseLocalDate(endDate, true)
      if (from && to && from > to) {
        return {
          from: parseLocalDate(endDate, false),
          to: parseLocalDate(startDate, true),
        }
      }
      return { from, to }
    }
    case 'all':
      return { from: null, to: null }
    default:
      start.setDate(start.getDate() - 30)
      start.setHours(0, 0, 0, 0)
      return { from: start, to: end }
  }
}

export function getEffectiveSource(lead: ProfileLead): string {
  if (lead.utm_source) return lead.utm_source.toLowerCase()
  const di = parseDeviceInfo(lead)
  const deviceSource = di.source || di.verification_source
  if (typeof deviceSource === 'string' && deviceSource.toLowerCase().includes('sellerlanding')) {
    return 'sellerlanding'
  }
  try {
    const landingUrl = typeof di.landing_url === 'string' ? di.landing_url : ''
    if (landingUrl) {
      if (landingUrl.toLowerCase().includes('/sellerlanding')) return 'sellerlanding'
      const params = new URLSearchParams(new URL(landingUrl).search)
      if (params.get('utm_source')) return params.get('utm_source')!.toLowerCase()
      if (params.get('gclid') || params.get('gad_source')) return 'google'
      if (params.get('fbclid')) return 'facebook'
    }
  } catch {
    /* ignore */
  }
  try {
    const referrer = typeof di.referrer === 'string' ? di.referrer : ''
    if (referrer) {
      const host = new URL(referrer).hostname.replace(/^www\./, '')
      if (host.includes('google.')) return 'google'
      if (host.includes('facebook.') || host.includes('fb.com')) return 'facebook'
      if (host.includes('instagram.')) return 'instagram'
      if (host.includes('linkedin.')) return 'linkedin'
      if (host.includes('twitter.') || host.includes('x.com')) return 'twitter'
      if (host.includes('youtube.')) return 'youtube'
      return 'organic'
    }
  } catch {
    /* ignore */
  }
  return 'direct'
}

export function getEffectiveMedium(lead: ProfileLead): string | null {
  if (lead.utm_medium) return lead.utm_medium
  const di = parseDeviceInfo(lead)
  try {
    const landingUrl = typeof di.landing_url === 'string' ? di.landing_url : ''
    if (landingUrl) {
      const params = new URLSearchParams(new URL(landingUrl).search)
      if (params.get('utm_medium')) return params.get('utm_medium')
      if (params.get('gclid') || params.get('gad_source')) return 'cpc'
    }
  } catch {
    /* ignore */
  }
  return null
}

export function getEffectiveCampaign(lead: ProfileLead): string | null {
  if (lead.utm_campaign) return lead.utm_campaign
  const di = parseDeviceInfo(lead)
  try {
    const landingUrl = typeof di.landing_url === 'string' ? di.landing_url : ''
    if (landingUrl) {
      const params = new URLSearchParams(new URL(landingUrl).search)
      if (params.get('utm_campaign')) return params.get('utm_campaign')
      if (params.get('gad_campaignid')) return `gad:${params.get('gad_campaignid')}`
    }
  } catch {
    /* ignore */
  }
  return null
}

export function resolveJourneyStatus(lead: ProfileLead): JourneyStatus {
  if (lead.role === 'V') return 'seller'
  if (lead.is_verified && lead.gender) return 'face_verified'
  if (lead.is_verified) return 'verified'
  return 'otp_only'
}

export function formatDateTime(ts: string | null | undefined) {
  if (!ts) return { date: '—', time: '—' }
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—' }
  return {
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  }
}

export function buildSellerLeadsCsv(leads: LeadWithJourney[]) {
  const headers = [
    'Name',
    'Username',
    'Email',
    'Phone',
    'Business',
    'Source',
    'Medium',
    'Campaign',
    'Journey',
    'Created At',
  ]
  const rows = leads.map((l) => [
    l.full_name || '',
    l.username || '',
    l.email || '',
    l.phone || '',
    l.business_name || '',
    getEffectiveSource(l),
    getEffectiveMedium(l) || '',
    getEffectiveCampaign(l) || '',
    l.journeyStatus,
    new Date(l.created_at).toLocaleString('en-IN'),
  ])
  return [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export const DATE_PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: '90days', label: 'Last 90 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'custom', label: 'Custom Range' },
]

export const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All Stages' },
  { key: 'otp_only', label: 'OTP Only' },
  { key: 'verified', label: 'Verified' },
  { key: 'face_verified', label: 'Face Verified' },
  { key: 'seller', label: 'Seller' },
]

export const STATUS_CONFIG: Record<
  JourneyStatus,
  { label: string; bg: string; color: string; border: string; dot: string }
> = {
  seller: {
    label: 'Seller',
    bg: '#D1FAE5',
    color: '#047857',
    border: '#A7F3D0',
    dot: '#10B981',
  },
  face_verified: {
    label: 'Face Verified',
    bg: '#DBEAFE',
    color: '#1D4ED8',
    border: '#BFDBFE',
    dot: '#3B82F6',
  },
  verified: {
    label: 'Verified',
    bg: '#F3E8FF',
    color: '#7E22CE',
    border: '#E9D5FF',
    dot: '#A855F7',
  },
  otp_only: {
    label: 'OTP Only',
    bg: '#FEF3C7',
    color: '#B45309',
    border: '#FDE68A',
    dot: '#F59E0B',
  },
}
