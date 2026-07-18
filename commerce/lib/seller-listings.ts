import { supabase } from '~/lib/supabase'
import type { Database, Tables, TablesUpdate } from '~/lib/supabase'
import { slugifyTitle } from '~/commerce/lib/seo-urls'
import { INVALIDATION_TOPICS, invalidateCache } from '~/lib/cache/invalidation'

/** Refresh every browse/category/home feed that can show seller inventory. */
function invalidateSellerCatalogueCaches() {
  invalidateCache(
    'feed:categories',
    'feed:shops',
    'route:shops-browse',
    'route:home',
    INVALIDATION_TOPICS.commerceListings,
    INVALIDATION_TOPICS.commerceShops,
  )
}

type ListingType = Database['public']['Enums']['listing_type_enum']
type ListingStatus = Database['public']['Enums']['listing_status_enum']

export type CreateListingInput = {
  shopId: string
  title: string
  description?: string
  price: number
  mrp?: number | null
  priceIncludesTax?: boolean
  taxPercent?: number | null
  productInfo?: Record<string, string> | null
  listingType: ListingType
  quantity?: number
  category?: string
  imageUrl?: string
  imageUrls?: string[]
  media?: Array<{ url: string; type: 'image' | 'video' }>
  publish?: boolean
}

export type UpdateListingInput = {
  title?: string
  description?: string
  price?: number
  quantity?: number
  category?: string
  listingStatus?: ListingStatus
  isActive?: boolean
}

export type UpdateShopProfileInput = Pick<
  Tables<'shops'>,
  | 'shop_name'
  | 'shop_description'
  | 'shop_email'
  | 'shop_phone_number'
  | 'website_url'
  | 'is_active'
> & {
  shop_metadata?: Tables<'shops'>['shop_metadata']
}

export async function createSellerListing(input: CreateListingInput) {
  const title = input.title.trim()
  const slug = slugifyTitle(title)
  const listingStatus: ListingStatus = input.publish ? 'active' : 'draft'

  const { data, error } = await supabase
    .from('listings')
    .insert({
      shop_id: input.shopId,
      title,
      slug,
      description: input.description?.trim() || null,
      price: input.price,
      mrp: input.mrp ?? null,
      price_includes_tax: input.priceIncludesTax ?? true,
      tax_percent: input.taxPercent ?? null,
      product_info: input.productInfo ?? {},
      listing_type: input.listingType,
      listing_status: listingStatus,
      is_active: input.publish ?? false,
      quantity: input.quantity ?? (input.listingType === 'digital' ? null : 1),
      stock: input.quantity ?? (input.listingType === 'digital' ? null : 1),
      category: input.category?.trim() || null,
      shipping_required: input.listingType === 'physical',
      published_at: input.publish ? new Date().toISOString() : null,
    })
    .select('id, slug, title, listing_status')
    .single()

  if (error || !data) {
    return { listing: null, error: error?.message ?? 'Could not create listing.' }
  }

  const mediaItems =
    input.media?.length
      ? input.media
      : (input.imageUrls?.length
          ? input.imageUrls
          : input.imageUrl?.trim()
            ? [input.imageUrl.trim()]
            : []
        ).map((url) => ({ url, type: 'image' as const }))

  if (mediaItems.length > 0) {
    await supabase.from('listing_images').insert(
      mediaItems.map((item, index) => ({
        listing_id: data.id,
        image_url: item.url,
        image_type: item.type === 'video' ? 'video' : 'image',
        is_primary: index === 0,
        display_order: index,
      })),
    )
  }

  invalidateSellerCatalogueCaches()

  return { listing: data, error: null as string | null }
}

export async function updateSellerListing(listingId: string, shopId: string, input: UpdateListingInput) {
  const payload: TablesUpdate<'listings'> = {}

  if (input.title != null) {
    payload.title = input.title.trim()
    payload.slug = slugifyTitle(input.title)
  }
  if (input.description != null) payload.description = input.description.trim() || null
  if (input.price != null) payload.price = input.price
  if (input.quantity != null) {
    payload.quantity = input.quantity
    payload.stock = input.quantity
  }
  if (input.category != null) payload.category = input.category.trim() || null
  if (input.listingStatus != null) {
    payload.listing_status = input.listingStatus
    payload.is_active = input.listingStatus === 'active'
    payload.published_at =
      input.listingStatus === 'active' ? new Date().toISOString() : null
  }
  if (input.isActive != null) payload.is_active = input.isActive

  const { data, error } = await supabase
    .from('listings')
    .update(payload)
    .eq('id', listingId)
    .eq('shop_id', shopId)
    .select('id, slug, title, listing_status, is_active')
    .single()

  if (error) {
    return { listing: null, error: error.message }
  }

  invalidateSellerCatalogueCaches()

  return { listing: data, error: null as string | null }
}

export async function updateShopProfile(shopId: string, userId: string, input: UpdateShopProfileInput) {
  const { data, error } = await supabase
    .from('shops')
    .update({
      shop_name: input.shop_name,
      shop_description: input.shop_description,
      shop_email: input.shop_email,
      shop_phone_number: input.shop_phone_number,
      website_url: input.website_url,
      is_active: input.is_active,
      ...(input.shop_metadata !== undefined ? { shop_metadata: input.shop_metadata } : {}),
    })
    .eq('id', shopId)
    .eq('user_id', userId)
    .select(
      'id, shop_name, shop_description, logo_url, shop_currency, shop_email, shop_phone_number, website_url, shop_metadata, average_rating, total_reviews, verified, is_active, created_at, slug',
    )
    .single()

  if (error) {
    return { shop: null, error: error.message }
  }

  invalidateSellerCatalogueCaches()

  return { shop: data, error: null as string | null }
}

export async function updateShopLogo(shopId: string, userId: string, logoUrl: string) {
  const { data, error } = await supabase
    .from('shops')
    .update({ logo_url: logoUrl })
    .eq('id', shopId)
    .eq('user_id', userId)
    .select(
      'id, shop_name, shop_description, logo_url, shop_currency, shop_email, shop_phone_number, website_url, average_rating, total_reviews, verified, is_active, created_at, slug',
    )
    .single()

  if (error) {
    return { shop: null, error: error.message }
  }

  return { shop: data, error: null as string | null }
}
