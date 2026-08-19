import type { EnrollmentWithEvent, SaleEventForVendor } from '~/lib/sale-event/sale-event.type'
import { ENROLLMENT_STATUS } from '~/lib/sale-event/sale-event.type'
import {
  getEnrollmentStatusLabel,
  getEventDurationLabel,
  getRegistrationLabel,
  isRegistrationOpen,
} from '~/lib/sale-event/sale-event.utils'
import { getActiveEvents, getVendorEnrollments } from '~/lib/sale-event/sale-event.service'
import { vendorRoutes } from '~/lib/routes'

export type VendorSaleEventHomeCard = {
  id: string
  title: string
  badge: string
  detail: string
  imageUrl: string | null
  href: string
  priority: number
}

function enrollmentPriority(status: string) {
  if (status === ENROLLMENT_STATUS.PENDING) return 0
  if (status === ENROLLMENT_STATUS.ACCEPTED) return 2
  return 4
}

export function buildVendorSaleEventHomeCards(
  enrollments: EnrollmentWithEvent[],
  activeEvents: SaleEventForVendor[],
  limit = 5,
): VendorSaleEventHomeCard[] {
  const now = Date.now()
  const enrolledEventIds = new Set(enrollments.map((row) => row.event_id).filter(Boolean))
  const cards: VendorSaleEventHomeCard[] = []

  for (const enrollment of enrollments) {
    if (enrollment.enrollment_status === ENROLLMENT_STATUS.REJECTED) continue
    const event = enrollment.sale_events
    if (!event || event.status !== 'active') continue
    if (new Date(event.end_date).getTime() < now) continue

    cards.push({
      id: enrollment.id,
      title: event.event_name,
      badge: getEnrollmentStatusLabel(enrollment.enrollment_status),
      detail:
        enrollment.enrollment_status === ENROLLMENT_STATUS.PENDING
          ? 'Your enrollment is waiting for admin approval.'
          : getEventDurationLabel(event),
      imageUrl: event.banner_image,
      href: vendorRoutes.ads,
      priority: enrollmentPriority(enrollment.enrollment_status),
    })
  }

  for (const event of activeEvents) {
    if (enrolledEventIds.has(event.id)) continue
    if (!isRegistrationOpen(event)) continue

    cards.push({
      id: `open-${event.id}`,
      title: event.event_name,
      badge: 'Join sale event',
      detail: getRegistrationLabel(event),
      imageUrl: event.banner_image,
      href: vendorRoutes.ads,
      priority: 1,
    })
  }

  return cards.sort((a, b) => a.priority - b.priority).slice(0, limit)
}

export async function fetchVendorSaleEventHomeCards(
  shopId: string,
  limit = 5,
): Promise<{ cards: VendorSaleEventHomeCard[]; error: string | null }> {
  const [enrollmentsRes, activeEventsRes] = await Promise.all([
    getVendorEnrollments(shopId),
    getActiveEvents(),
  ])

  if (enrollmentsRes.error && activeEventsRes.error) {
    return { cards: [], error: enrollmentsRes.error ?? activeEventsRes.error }
  }

  return {
    cards: buildVendorSaleEventHomeCards(
      enrollmentsRes.data ?? [],
      activeEventsRes.data ?? [],
      limit,
    ),
    error: null,
  }
}
