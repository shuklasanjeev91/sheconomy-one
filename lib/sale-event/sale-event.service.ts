/**
 * Sale Events service — typed Supabase data-access layer.
 *
 * Ported 1:1 from `sales.event-service.js` into flat, typed functions (same
 * shape as `shop.service` / `cms.service`). UI code should dispatch store thunks
 * rather than calling these directly.
 *
 * The layer is role-agnostic: normal users, vendors and admins all call the same
 * functions — row visibility / write permission is enforced by Supabase RLS
 * (`sale_events` etc. gate on `public.cms_get_role()` → 'A' | 'V' | 'U').
 *
 * Every function returns a `SaleServiceResponse<T>` and routes failures through
 * `sale.errors` so messages are always user-friendly.
 */

import { supabase } from '~/lib/supabase'
import type { Database } from '~/lib/supabase'
import { getStoragePublicUrl, uploadStorageObject } from '~/lib/supabase/storage-upload'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'

import { toFriendlySaleError } from '~/lib/sale-event/sale-event.errors'
import {
  SALE_BANNER_BUCKET,
  SALE_BANNER_MAX_BYTES,
  type CategoryPickerParams,
  type CreateEventInput,
  type CreateOfferInput,
  type EnrolledEventDiscount,
  type EnrollmentDecision,
  type EnrollmentWithEvent,
  type EnrollmentWithShop,
  type EventOffer,
  type EventOfferWithLinks,
  type ListingPickerParams,
  type SaleBannerUploadFile,
  type SaleCategoryOption,
  type SaleEvent,
  type SaleEventDetail,
  type SaleEventForVendor,
  type SaleEventWithCounts,
  type SaleListingOption,
  type SaleServiceResponse,
  type UpdateEventInput,
  type VendorEnrollment,
} from '~/lib/sale-event/sale-event.type'

// ============= RESPONSE HELPERS =============

function ok<T>(data: T, meta?: SaleServiceResponse<T>['meta']): SaleServiceResponse<T> {
  return { data, error: null, success: true, meta }
}

function fail<T>(error: unknown, fallback?: string): SaleServiceResponse<T> {
  return { data: null, error: toFriendlySaleError(error, fallback), success: false }
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('User not authenticated')
  return data.user.id
}

type CategoryStatus = Database['public']['Enums']['category_status_enum']
type ListingType = Database['public']['Enums']['listing_type_enum']

// ============= SELECT FRAGMENTS =============

const EVENT_DETAIL_SELECT = `
  *,
  event_offers (
    *,
    event_offer_categories ( id, category_id ),
    event_offer_listings   ( id, listing_id )
  ),
  vendor_event_enrollments ( id, enrollment_status )
`

// ============================================================================
// ADMIN — EVENTS
// ============================================================================

/** Insert a new sale event. `created_by` is stamped from the signed-in admin. */
export async function createSaleEvent(
  input: CreateEventInput,
): Promise<SaleServiceResponse<SaleEvent>> {
  try {
    const userId = await requireUserId()
    const { data, error } = await supabase
      .from('sale_events')
      .insert({
        event_name: input.event_name,
        event_slug: input.event_slug,
        description: input.description ?? null,
        start_date: input.start_date,
        end_date: input.end_date,
        banner_image: input.banner_image ?? null,
        status: input.status ?? 'draft',
        currency: input.currency ?? 'INR',
        registration_start_date: input.registration_start_date ?? null,
        registration_end_date: input.registration_end_date ?? null,
        created_by: userId,
      })
      .select()
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

/** Update an existing sale event by id. */
export async function updateSaleEvent(
  eventId: string,
  input: UpdateEventInput,
): Promise<SaleServiceResponse<SaleEvent>> {
  try {
    const { data, error } = await supabase
      .from('sale_events')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .select()
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

/** Delete a sale event (DB CASCADE removes offers, links, and enrollments). */
export async function deleteSaleEvent(eventId: string): Promise<SaleServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase.from('sale_events').delete().eq('id', eventId)
    if (error) return fail(error)
    return ok({ id: eventId })
  } catch (error) {
    return fail(error)
  }
}

/** All events with offer + enrollment aggregate counts (admin list). */
export async function getAllEvents(): Promise<SaleServiceResponse<SaleEventWithCounts[]>> {
  try {
    const { data, error } = await supabase
      .from('sale_events')
      .select('*, event_offers ( id ), vendor_event_enrollments ( id, enrollment_status )')
      .order('created_at', { ascending: false })

    if (error) return fail(error)

    const enriched = (data ?? []).map((event) => {
      const { event_offers, vendor_event_enrollments, ...rest } = event as SaleEvent & {
        event_offers: { id: string }[] | null
        vendor_event_enrollments: { id: string; enrollment_status: string }[] | null
      }
      return {
        ...rest,
        offer_count: event_offers?.length ?? 0,
        enrollment_count: vendor_event_enrollments?.length ?? 0,
        accepted_count:
          vendor_event_enrollments?.filter((e) => e.enrollment_status === 'accepted').length ?? 0,
      }
    })

    return ok(enriched)
  } catch (error) {
    return fail(error)
  }
}

/** Single event with full offer details (categories + listings) and counts. */
export async function getEventById(id: string): Promise<SaleServiceResponse<SaleEventDetail>> {
  try {
    const { data, error } = await supabase
      .from('sale_events')
      .select(EVENT_DETAIL_SELECT)
      .eq('id', id)
      .single()

    if (error) return fail(error)

    const row = data as unknown as SaleEvent & {
      event_offers: EventOfferWithLinks[] | null
      vendor_event_enrollments: { id: string; enrollment_status: string }[] | null
    }

    const detail: SaleEventDetail = {
      ...row,
      event_offers: row.event_offers ?? [],
      offer_count: row.event_offers?.length ?? 0,
      enrollment_count: row.vendor_event_enrollments?.length ?? 0,
      accepted_count:
        row.vendor_event_enrollments?.filter((e) => e.enrollment_status === 'accepted').length ?? 0,
    }

    return ok(detail)
  } catch (error) {
    return fail(error)
  }
}

/** Single event by slug with its offers (public storefront). */
export async function getEventBySlug(slug: string): Promise<SaleServiceResponse<SaleEventDetail>> {
  try {
    const { data, error } = await supabase
      .from('sale_events')
      .select(EVENT_DETAIL_SELECT)
      .eq('event_slug', slug)
      .single()

    if (error) return fail(error)

    const row = data as unknown as SaleEvent & {
      event_offers: EventOfferWithLinks[] | null
      vendor_event_enrollments: { id: string; enrollment_status: string }[] | null
    }

    const detail: SaleEventDetail = {
      ...row,
      event_offers: row.event_offers ?? [],
      offer_count: row.event_offers?.length ?? 0,
      enrollment_count: row.vendor_event_enrollments?.length ?? 0,
      accepted_count:
        row.vendor_event_enrollments?.filter((e) => e.enrollment_status === 'accepted').length ?? 0,
    }

    return ok(detail)
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// ADMIN — OFFERS
// ============================================================================

/** Insert a new event offer. */
export async function createEventOffer(
  input: CreateOfferInput,
): Promise<SaleServiceResponse<EventOffer>> {
  try {
    const { data, error } = await supabase
      .from('event_offers')
      .insert({
        event_id: input.event_id,
        offer_name: input.offer_name,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        max_discount_amount: input.max_discount_amount ?? null,
        min_order_amount: input.min_order_amount ?? 0,
        max_uses_total: input.max_uses_total ?? null,
        max_uses_per_customer: input.max_uses_per_customer ?? 1,
        applies_to: input.applies_to,
        currency: input.currency ?? 'INR',
      })
      .select()
      .single()

    if (error) return fail(error)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

/** Single offer with its attached category + listing ids (attach-items page). */
export async function getOfferById(
  offerId: string,
): Promise<SaleServiceResponse<EventOfferWithLinks>> {
  try {
    const { data, error } = await supabase
      .from('event_offers')
      .select('*, event_offer_categories ( id, category_id ), event_offer_listings ( id, listing_id )')
      .eq('id', offerId)
      .single()

    if (error) return fail(error)
    return ok(data as unknown as EventOfferWithLinks)
  } catch (error) {
    return fail(error)
  }
}

/** Attach categories to an offer (idempotent — duplicates ignored). */
export async function attachOfferCategories(
  offerId: string,
  categoryIds: string[],
): Promise<SaleServiceResponse<{ count: number }>> {
  try {
    const rows = categoryIds.map((category_id) => ({ offer_id: offerId, category_id }))
    const { data, error } = await supabase
      .from('event_offer_categories')
      .upsert(rows, { onConflict: 'offer_id,category_id', ignoreDuplicates: true })
      .select()

    if (error) return fail(error)
    return ok({ count: data?.length ?? 0 })
  } catch (error) {
    return fail(error)
  }
}

/** Attach listings to an offer (idempotent — duplicates ignored). */
export async function attachOfferListings(
  offerId: string,
  listingIds: string[],
): Promise<SaleServiceResponse<{ count: number }>> {
  try {
    const rows = listingIds.map((listing_id) => ({ offer_id: offerId, listing_id }))
    const { data, error } = await supabase
      .from('event_offer_listings')
      .upsert(rows, { onConflict: 'offer_id,listing_id', ignoreDuplicates: true })
      .select()

    if (error) return fail(error)
    return ok({ count: data?.length ?? 0 })
  } catch (error) {
    return fail(error)
  }
}

/** Replace ALL categories on an offer (delete existing, insert new selection). */
export async function replaceOfferCategories(
  offerId: string,
  categoryIds: string[],
): Promise<SaleServiceResponse<{ count: number }>> {
  try {
    const { error: delErr } = await supabase
      .from('event_offer_categories')
      .delete()
      .eq('offer_id', offerId)
    if (delErr) return fail(delErr)

    if (!categoryIds.length) return ok({ count: 0 })

    const rows = categoryIds.map((category_id) => ({ offer_id: offerId, category_id }))
    const { data, error } = await supabase.from('event_offer_categories').insert(rows).select()
    if (error) return fail(error)
    return ok({ count: data?.length ?? 0 })
  } catch (error) {
    return fail(error)
  }
}

/** Replace ALL listings on an offer (delete existing, insert new selection). */
export async function replaceOfferListings(
  offerId: string,
  listingIds: string[],
): Promise<SaleServiceResponse<{ count: number }>> {
  try {
    const { error: delErr } = await supabase
      .from('event_offer_listings')
      .delete()
      .eq('offer_id', offerId)
    if (delErr) return fail(delErr)

    if (!listingIds.length) return ok({ count: 0 })

    const rows = listingIds.map((listing_id) => ({ offer_id: offerId, listing_id }))
    const { data, error } = await supabase.from('event_offer_listings').insert(rows).select()
    if (error) return fail(error)
    return ok({ count: data?.length ?? 0 })
  } catch (error) {
    return fail(error)
  }
}

/** Categories already attached to an offer (edit / review mode). */
export async function getOfferCategories(
  offerId: string,
): Promise<SaleServiceResponse<{ id: string; category_id: string }[]>> {
  try {
    const { data, error } = await supabase
      .from('event_offer_categories')
      .select('id, category_id')
      .eq('offer_id', offerId)

    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

/** Listings already attached to an offer (edit / review mode). */
export async function getOfferListings(
  offerId: string,
): Promise<SaleServiceResponse<{ id: string; listing_id: string }[]>> {
  try {
    const { data, error } = await supabase
      .from('event_offer_listings')
      .select('id, listing_id')
      .eq('offer_id', offerId)

    if (error) return fail(error)
    return ok(data ?? [])
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// ADMIN — ENROLLMENTS
// ============================================================================

/** All vendor enrollments for an event, with shop details (admin review). */
export async function getEventEnrollments(
  eventId: string,
): Promise<SaleServiceResponse<EnrollmentWithShop[]>> {
  try {
    const { data, error } = await supabase
      .from('vendor_event_enrollments')
      .select('*, shops ( id, shop_name, slug, logo_url )')
      .eq('event_id', eventId)
      .order('enrolled_at', { ascending: false })

    if (error) return fail(error)
    return ok((data ?? []) as unknown as EnrollmentWithShop[])
  } catch (error) {
    return fail(error)
  }
}

/**
 * Accept or reject a vendor enrollment. The DB trigger `trg_sync_event_discounts`
 * keeps `discount_profiles` in sync automatically.
 */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentDecision,
): Promise<SaleServiceResponse<VendorEnrollment>> {
  try {
    const { data, error } = await supabase
      .from('vendor_event_enrollments')
      .update({ enrollment_status: status, updated_at: new Date().toISOString() })
      .eq('id', enrollmentId)
      .select()
      .single()

    if (error) return fail(error)
    invalidateCache(INVALIDATION_TOPICS.commerceSaleEvents)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// VENDOR — EVENTS & ENROLLMENTS
// ============================================================================

/** All currently active events with summarised offers (vendor discovery). */
export async function getActiveEvents(): Promise<SaleServiceResponse<SaleEventForVendor[]>> {
  try {
    const { data, error } = await supabase
      .from('sale_events')
      .select(
        '*, event_offers ( id, offer_name, discount_type, discount_value, applies_to )',
      )
      .eq('status', 'active')
      .order('start_date', { ascending: true })

    if (error) return fail(error)
    return ok((data ?? []) as unknown as SaleEventForVendor[])
  } catch (error) {
    return fail(error)
  }
}

/** Enroll a shop into a sale event (RLS validates ownership + active event). */
export async function joinEvent(
  eventId: string,
  shopId: string,
): Promise<SaleServiceResponse<VendorEnrollment>> {
  try {
    const { data, error } = await supabase
      .from('vendor_event_enrollments')
      .insert({ event_id: eventId, shop_id: shopId, enrollment_status: 'pending' })
      .select()
      .single()

    if (error) return fail(error)
    invalidateCache(INVALIDATION_TOPICS.commerceSaleEvents)
    return ok(data)
  } catch (error) {
    return fail(error)
  }
}

/** Withdraw a pending enrollment (RLS blocks withdrawing accepted rows). */
export async function withdrawEnrollment(
  enrollmentId: string,
): Promise<SaleServiceResponse<{ id: string }>> {
  try {
    const { error } = await supabase
      .from('vendor_event_enrollments')
      .delete()
      .eq('id', enrollmentId)

    if (error) return fail(error)
    invalidateCache(INVALIDATION_TOPICS.commerceSaleEvents)
    return ok({ id: enrollmentId })
  } catch (error) {
    return fail(error)
  }
}

/** All enrollments for a shop, joined with event details (vendor dashboard). */
export async function getVendorEnrollments(
  shopId: string,
): Promise<SaleServiceResponse<EnrollmentWithEvent[]>> {
  try {
    const { data, error } = await supabase
      .from('vendor_event_enrollments')
      .select(
        `*, sale_events ( id, event_name, event_slug, description, start_date, end_date, banner_image, status )`,
      )
      .eq('shop_id', shopId)
      .order('enrolled_at', { ascending: false })

    if (error) return fail(error)
    return ok((data ?? []) as unknown as EnrollmentWithEvent[])
  } catch (error) {
    return fail(error)
  }
}

/**
 * Event-sourced discount profiles for a shop, with offer + parent event context.
 * Vendors call this to see which event discounts are active for their shop.
 */
export async function getEnrolledEventDiscounts(
  shopId: string,
): Promise<SaleServiceResponse<EnrolledEventDiscount[]>> {
  try {
    const { data, error } = await supabase
      .from('discount_profiles')
      .select(
        `*, event_offers ( id, offer_name, discount_type, discount_value, sale_events ( id, event_name, event_slug ) )`,
      )
      .eq('shop_id', shopId)
      .eq('source', 'event')
      .order('created_at', { ascending: false })

    if (error) return fail(error)
    return ok((data ?? []) as unknown as EnrolledEventDiscount[])
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// PICKERS — CATEGORIES & LISTINGS (admin offer creation)
// ============================================================================

/**
 * Active categories for the offer category picker. Top-level by default;
 * pass `parentId` to drill into children, or `search` to filter by name.
 *
 * NOTE: `categories.category_id` is TEXT (e.g. '1', '10', '103').
 */
export async function getCategories(
  options: CategoryPickerParams = {},
): Promise<SaleServiceResponse<SaleCategoryOption[]>> {
  try {
    const { parentId = null, search = null, status = 'A', langCode = 'en' } = options

    let query = supabase
      .from('categories')
      .select(
        'category_id, parent_id, category, description, level, position, product_count, status, seo_name, seo_path, category_image_url, main_pair',
      )
      .eq('status', status as CategoryStatus)
      .eq('lang_code', langCode)
      .order('position', { ascending: true })

    if (parentId === null) query = query.is('parent_id', null)
    else query = query.eq('parent_id', parentId)

    if (search && search.trim().length > 0) query = query.ilike('category', `%${search.trim()}%`)

    const { data, error } = await query
    if (error) return fail(error)
    return ok((data ?? []) as unknown as SaleCategoryOption[])
  } catch (error) {
    return fail(error)
  }
}

/** Sub-categories of a given parent. */
export async function getCategoriesByParent(
  parentId: string,
): Promise<SaleServiceResponse<SaleCategoryOption[]>> {
  return getCategories({ parentId })
}

/** Full flat active category tree (all levels) for bulk pickers. */
export async function getAllActiveCategories(): Promise<SaleServiceResponse<SaleCategoryOption[]>> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select(
        'category_id, parent_id, category, level, position, status, seo_name, category_image_url, main_pair',
      )
      .eq('status', 'A' as CategoryStatus)
      .order('level', { ascending: true })
      .order('position', { ascending: true })

    if (error) return fail(error)
    return ok((data ?? []) as unknown as SaleCategoryOption[])
  } catch (error) {
    return fail(error)
  }
}

/**
 * Active listings for the offer product picker. Scope with `shopIds` or pull
 * platform-wide; supports title search, type filter and paging (infinite scroll).
 */
export async function getListingsForOfferPicker(
  options: ListingPickerParams = {},
): Promise<SaleServiceResponse<SaleListingOption[]>> {
  try {
    const { shopIds = null, search = null, listingType = null, limit = 50, offset = 0 } = options

    let query = supabase
      .from('listings')
      .select(
        `id, shop_id, title, description, listing_type, price, stock, listing_status, is_active, slug, category, sku,
         listing_images ( image_url, is_primary, display_order ),
         shops ( id, shop_name )`,
      )
      .eq('is_active', true)
      .eq('listing_status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (shopIds && shopIds.length > 0) query = query.in('shop_id', shopIds)
    if (listingType) query = query.eq('listing_type', listingType as ListingType)
    if (search && search.trim().length > 0) query = query.ilike('title', `%${search.trim()}%`)

    const { data, error } = await query
    if (error) return fail(error)

    type PickerRow = {
      id: string
      shop_id: string
      title: string
      description: string | null
      listing_type: string
      price: number
      stock: number | null
      listing_status: string
      slug: string | null
      category: string | null
      sku: string | null
      listing_images: { image_url: string; is_primary: boolean | null; display_order: number | null }[] | null
      shops: { id: string; shop_name: string } | null
    }

    const normalized: SaleListingOption[] = ((data ?? []) as unknown as PickerRow[]).map((listing) => {
      const sorted = [...(listing.listing_images ?? [])].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
      )
      const primaryImg = sorted.find((img) => img.is_primary) ?? sorted[0] ?? null

      return {
        id: listing.id,
        shop_id: listing.shop_id,
        shop_name: listing.shops?.shop_name ?? null,
        title: listing.title,
        description: listing.description,
        listing_type: listing.listing_type,
        price: listing.price,
        stock: listing.stock,
        listing_status: listing.listing_status,
        slug: listing.slug,
        category: listing.category,
        sku: listing.sku,
        primary_image_url: primaryImg?.image_url ?? null,
      }
    })

    return ok(normalized, {
      total: offset + normalized.length,
      limit,
      offset,
      hasMore: normalized.length === limit,
    })
  } catch (error) {
    return fail(error)
  }
}

// ============================================================================
// BANNER — STORAGE
// ============================================================================

/**
 * Upload a banner image to the `sale-event-banners` bucket and return its
 * public URL. The form keeps the URL in `banner_image` — no DB write here.
 */
export async function uploadBannerImage(
  file: SaleBannerUploadFile,
  eventId?: string,
): Promise<SaleServiceResponse<{ url: string; path: string }>> {
  try {
    const ext = file.fileName.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg') ?? 'jpeg'
    const folder = eventId ? `events/${eventId}` : 'events/unsaved'
    const storagePath = `${folder}/banner_${Date.now()}.${ext}`

    const upload = await uploadStorageObject(
      SALE_BANNER_BUCKET,
      storagePath,
      file.blob,
      file.mimeType,
      { maxBytes: SALE_BANNER_MAX_BYTES },
    )
    if (upload.error || !upload.data) return fail(upload.error ?? 'Upload failed')

    return ok({ url: upload.data.publicUrl, path: storagePath })
  } catch (error) {
    return fail(error)
  }
}

/**
 * Delete a banner image from storage given its public URL. Safe to call with
 * external / legacy URLs — those are silently ignored.
 */
export async function deleteBannerImage(
  publicUrl: string | null | undefined,
): Promise<SaleServiceResponse<{ removed: boolean }>> {
  try {
    if (!publicUrl || typeof publicUrl !== 'string') return ok({ removed: false })

    const marker = `/storage/v1/object/public/${SALE_BANNER_BUCKET}/`
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return ok({ removed: false })

    const storagePath = decodeURIComponent(publicUrl.slice(idx + marker.length))
    const { error } = await supabase.storage.from(SALE_BANNER_BUCKET).remove([storagePath])
    if (error) return fail(error)
    return ok({ removed: true })
  } catch (error) {
    return fail(error)
  }
}

/** Public URL for a banner storage path (helper for previews). */
export function getBannerPublicUrl(path: string): string {
  return getStoragePublicUrl(SALE_BANNER_BUCKET, path)
}
