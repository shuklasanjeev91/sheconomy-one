/**
 * Sale Events — pure helpers.
 *
 * Ported 1:1 from `sales.event-utils.js`, re-typed and made cross-platform:
 * anything that touched the browser `Image`/`URL` APIs now guards on web so the
 * same helpers are safe to import on native (react-native / one).
 */

import { Platform } from 'react-native'

import { getCurrencySymbol as getShopCurrencySymbol } from '~/lib/shop/shop.utils'

import {
  DEFAULT_SALE_BANNER_URL,
  DEFAULT_SALE_CURRENCY,
  SALE_BANNER_ACCEPTED_MIME,
  SALE_BANNER_MAX_BYTES,
  SALE_EVENT_STATUS,
  type CreateOfferInput,
  type DiscountType,
  type EnrollmentStatus,
  type SaleBannerUploadFile,
  type SaleBannerValidation,
  type SaleEvent,
  type VendorEnrollment,
} from '~/lib/sale-event/sale-event.type'

// ============= RESPONSE HELPERS =============

export function ok<T>(data: T, meta?: { total: number; limit: number; offset: number; hasMore: boolean }) {
  return { data, error: null, success: true as const, meta }
}

// ============= CURRENCY =============

/** Symbol for a currency code — delegates to the shared shop currency map. */
export function getCurrencySymbol(currencyCode?: string | null): string {
  return getShopCurrencySymbol(currencyCode ?? DEFAULT_SALE_CURRENCY)
}

/**
 * Format a discount value into a human-readable string.
 * @example formatDiscountLabel('percentage', 20) → "20% off"
 * @example formatDiscountLabel('fixed', 100, 'INR') → "₹100 off"
 */
export function formatDiscountLabel(
  discountType: DiscountType | string,
  discountValue: number,
  currency: string = DEFAULT_SALE_CURRENCY,
): string {
  if (discountType === 'percentage') return `${discountValue}% off`
  if (discountType === 'fixed') return `${getCurrencySymbol(currency)}${discountValue} off`
  return String(discountValue)
}

// ============= SLUG =============

/** Generate a URL-safe slug from an event name. */
export function generateEventSlug(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return ''
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 255)
}

// ============= EVENT STATUS =============

type EventDates = Pick<SaleEvent, 'status' | 'start_date' | 'end_date'> &
  Partial<Pick<SaleEvent, 'registration_start_date' | 'registration_end_date'>>

/** Whether an event is currently active based on its status + date window. */
export function isEventActive(event: EventDates | null | undefined): boolean {
  if (!event || event.status !== SALE_EVENT_STATUS.ACTIVE) return false
  const now = Date.now()
  const start = new Date(event.start_date).getTime()
  const end = new Date(event.end_date).getTime()
  return now >= start && now <= end
}

/** Whether an event's end date has passed. */
export function isEventExpired(event: Pick<SaleEvent, 'end_date'> | null | undefined): boolean {
  if (!event) return false
  return new Date(event.end_date).getTime() < Date.now()
}

/** Whether an event has not started yet. */
export function isEventUpcoming(event: Pick<SaleEvent, 'start_date'> | null | undefined): boolean {
  if (!event) return false
  return new Date(event.start_date).getTime() > Date.now()
}

// ============= REGISTRATION WINDOW =============

/**
 * Whether vendor registration is currently open.
 * When registration dates are null, registration follows the active window.
 */
export function isRegistrationOpen(event: EventDates | null | undefined): boolean {
  if (!event || event.status !== SALE_EVENT_STATUS.ACTIVE) return false
  const now = Date.now()
  const regStart = event.registration_start_date
    ? new Date(event.registration_start_date).getTime()
    : null
  const regEnd = event.registration_end_date
    ? new Date(event.registration_end_date).getTime()
    : null
  if (regStart && now < regStart) return false
  if (regEnd && now > regEnd) return false
  return true
}

/** Human-readable label for the registration window. */
export function getRegistrationLabel(event: EventDates | null | undefined): string {
  if (!event) return ''
  const now = Date.now()
  const regStart = event.registration_start_date
    ? new Date(event.registration_start_date).getTime()
    : null
  const regEnd = event.registration_end_date
    ? new Date(event.registration_end_date).getTime()
    : null

  if (regStart && now < regStart) {
    return `Registration opens ${formatEventDate(event.registration_start_date)}`
  }
  if (regEnd && now > regEnd) return 'Registration closed'
  if (regEnd) return `Register by ${formatEventDate(event.registration_end_date)}`
  return 'Registration open'
}

// ============= DATE FORMATTERS =============

/** Format a date string for display (locale-aware, en-IN). */
export function formatEventDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return 'Invalid date'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Human-readable duration label for an event.
 * @example "3 days left" | "Ended 2 hours ago" | "Starts in 5 days"
 */
export function getEventDurationLabel(
  event: Pick<SaleEvent, 'start_date' | 'end_date'> | null | undefined,
): string {
  if (!event) return ''
  const now = Date.now()
  const start = new Date(event.start_date).getTime()
  const end = new Date(event.end_date).getTime()

  const msToHuman = (ms: number) => {
    const totalMinutes = Math.floor(Math.abs(ms) / 60000)
    if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`
    const hours = Math.floor(totalMinutes / 60)
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`
    const days = Math.floor(hours / 24)
    return `${days} day${days !== 1 ? 's' : ''}`
  }

  if (now < start) return `Starts in ${msToHuman(start - now)}`
  if (now > end) return `Ended ${msToHuman(now - end)} ago`
  return `${msToHuman(end - now)} left`
}

// ============= BANNER =============

/** Return a banner URL, falling back to the platform default when absent. */
export function formatEventBanner(url: string | null | undefined): string {
  if (url && typeof url === 'string' && url.trim().length > 0) return url.trim()
  return DEFAULT_SALE_BANNER_URL
}

/**
 * Validate a banner file (type + size always; dimensions on web only).
 * On native the dimension/aspect-ratio check is skipped (no DOM `Image`).
 */
export function validateBannerFile(file: SaleBannerUploadFile | null): Promise<SaleBannerValidation> {
  if (!file) return Promise.resolve({ valid: false, error: 'No file selected' })

  if (!(SALE_BANNER_ACCEPTED_MIME as readonly string[]).includes(file.mimeType)) {
    return Promise.resolve({ valid: false, error: 'Only JPEG, PNG, or WebP images are accepted' })
  }

  if (file.fileSize > SALE_BANNER_MAX_BYTES) {
    const mb = (file.fileSize / 1024 / 1024).toFixed(1)
    return Promise.resolve({ valid: false, error: `File must be under 5 MB (got ${mb} MB)` })
  }

  // Dimension checks require the browser Image/URL APIs.
  if (Platform.OS !== 'web' || typeof URL === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve({ valid: true })
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file.blob)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const w = img.naturalWidth
      const h = img.naturalHeight

      if (w < 800) {
        resolve({ valid: false, error: `Image is too small (${w} px wide). Minimum width is 800 px.`, width: w, height: h })
        return
      }

      // Allowed ratios (±12%): 8:3 (desktop/hero), 2:1 (mobile), 8:5 (best mobile).
      const ratio = w / h
      const allowed = [8 / 3, 2 / 1, 8 / 5]
      const tolerance = 0.12
      const okRatio = allowed.some((r) => Math.abs(ratio - r) / r <= tolerance)

      if (!okRatio) {
        resolve({
          valid: false,
          error: `Aspect ratio ${w}×${h} is not supported. Use 8:3 (desktop), 2:1 or 8:5 (mobile).`,
          width: w,
          height: h,
        })
        return
      }

      resolve({ valid: true, width: w, height: h })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ valid: false, error: 'Could not read image dimensions' })
    }

    img.src = objectUrl
  })
}

// ============= OFFER NORMALIZER =============

/**
 * Normalize a raw offer form payload before validation/insert: coerce numeric
 * fields and clean optional nulls. Accepts string inputs from web forms.
 */
export function normalizeOfferPayload(
  payload: Partial<Record<keyof CreateOfferInput, unknown>> | null | undefined,
): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') return {}

  const toFloat = (val: unknown, fallback: number | null = null): number | null => {
    if (val === null || val === undefined || val === '') return fallback
    const n = typeof val === 'number' ? val : parseFloat(String(val))
    return Number.isNaN(n) ? fallback : n
  }

  const toInt = (val: unknown, fallback: number | null = null): number | null => {
    if (val === null || val === undefined || val === '') return fallback
    const n = typeof val === 'number' ? Math.trunc(val) : parseInt(String(val), 10)
    return Number.isNaN(n) ? fallback : n
  }

  return {
    ...payload,
    discount_value: toFloat(payload.discount_value, 0),
    max_discount_amount: toFloat(payload.max_discount_amount, null),
    min_order_amount: toFloat(payload.min_order_amount, 0),
    max_uses_total: toInt(payload.max_uses_total, null),
    max_uses_per_customer: toInt(payload.max_uses_per_customer, 1),
  }
}

// ============= ENROLLMENT =============

/** Whether a vendor can still withdraw from an enrollment (pending only). */
export function canWithdrawEnrollment(
  enrollment: Pick<VendorEnrollment, 'enrollment_status'> | null | undefined,
): boolean {
  return enrollment?.enrollment_status === 'pending'
}

/** Attach the `canWithdraw` display flag to a list of enrollment rows. */
export function formatEnrollments<T extends { enrollment_status: string }>(
  enrollments: T[] | null | undefined,
): Array<T & { canWithdraw: boolean }> {
  if (!Array.isArray(enrollments)) return []
  return enrollments.map((e) => ({ ...e, canWithdraw: e.enrollment_status === 'pending' }))
}

/** Human label for an enrollment status. */
export function getEnrollmentStatusLabel(status: EnrollmentStatus | string): string {
  switch (status) {
    case 'pending':
      return 'Pending review'
    case 'accepted':
      return 'Accepted'
    case 'rejected':
      return 'Rejected'
    default:
      return status
  }
}
