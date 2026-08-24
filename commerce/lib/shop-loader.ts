import type { LoaderProps } from 'one'

import { supabase } from '~/lib/supabase'
import type { Tables } from '~/lib/supabase'
import { isUuid, shopSlugMatches, slugifyTitle } from '~/commerce/lib/seo-urls'
import {
  normalizeShopAddress,
  type ShopAddress,
  type ShopOwnerProfile,
} from '~/commerce/lib/shop-location'
import { BRAND_NAME } from '~/config/brand'
import { commerceRoutes } from '~/lib/routes'
import { pageSeo, plainSnippet } from '~/lib/seo/seo-helpers'
import { publishSsrPageSeo } from '~/lib/seo/ssr-page-seo-slot'

export type ShopDetail = Pick<
  Tables<'shops'>,
  | 'id'
  | 'shop_name'
  | 'shop_description'
  | 'logo_url'
  | 'shop_email'
  | 'shop_phone_number'
  | 'shop_currency'
  | 'average_rating'
  | 'total_reviews'
  | 'verified'
  | 'is_active'
  | 'user_id'
  | 'slug'
  | 'website_url'
  | 'created_at'
  | 'shop_metadata'
> & {
  owner: ShopOwnerProfile | null
  address: ShopAddress | null
}

export const SHOP_DETAIL_SELECT = `
  id,
  shop_name,
  shop_description,
  logo_url,
  shop_email,
  shop_phone_number,
  shop_currency,
  average_rating,
  total_reviews,
  verified,
  is_active,
  user_id,
  slug,
  website_url,
  created_at,
  shop_metadata,
  shop_addresses(city, state, country, postal_code)
`

const OWNER_SELECT =
  'id, full_name, username, avatar_url, headline, location, is_verified, business_name'

type ShopRow = Omit<ShopDetail, 'owner' | 'address'> & {
  shop_addresses?: unknown
}

async function loadShopOwner(userId: string): Promise<ShopOwnerProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(OWNER_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

function mapShopRow(row: ShopRow): ShopDetail {
  const { shop_addresses, ...shop } = row
  return {
    ...shop,
    owner: null,
    address: normalizeShopAddress(shop_addresses),
  }
}

export type ShopLoaderResult = {
  data: ShopDetail | null
  error: string | null
}

export async function fetchShopDetail(shopRef: string): Promise<ShopLoaderResult> {
  let shopResult = isUuid(shopRef)
    ? await supabase.from('shops').select(SHOP_DETAIL_SELECT).eq('id', shopRef).maybeSingle()
    : await supabase.from('shops').select(SHOP_DETAIL_SELECT).eq('slug', shopRef).maybeSingle()

  if (!shopResult.data && !isUuid(shopRef)) {
    const slugGuess = shopRef.replace(/-/g, ' ')
    shopResult = await supabase
      .from('shops')
      .select(SHOP_DETAIL_SELECT)
      .ilike('shop_name', slugGuess)
      .maybeSingle()
  }

  if (!shopResult.data && !isUuid(shopRef)) {
    const { data: activeShops } = await supabase
      .from('shops')
      .select(SHOP_DETAIL_SELECT)
      .eq('is_active', true)
      .limit(250)

    const matched =
      activeShops?.find((row) => shopSlugMatches(row, shopRef)) ??
      activeShops?.find((row) => slugifyTitle(row.shop_name) === shopRef.toLowerCase()) ??
      null

    if (matched) {
      shopResult = { data: matched, error: null }
    }
  }

  if (!shopResult.data && !isUuid(shopRef)) {
    shopResult = await supabase.from('shops').select(SHOP_DETAIL_SELECT).eq('id', shopRef).maybeSingle()
  }

  if (shopResult.error || !shopResult.data) {
    return { data: null, error: shopResult.error?.message ?? 'Shop not found' }
  }

  const mappedShop = mapShopRow(shopResult.data as ShopRow)
  const owner = await loadShopOwner(mappedShop.user_id)

  return {
    data: {
      ...mappedShop,
      owner,
    },
    error: null,
  }
}

export async function shopLoader({
  params,
}: LoaderProps<{ slug?: string }>): Promise<ShopLoaderResult> {
  const slug = typeof params.slug === 'string' ? params.slug : params.slug?.[0]
  if (!slug) return { data: null, error: 'Shop not found' }
  const result = await fetchShopDetail(slug)
  if (result.data) {
    publishSsrPageSeo(
      pageSeo({
        title: result.data.shop_name,
        description:
          plainSnippet(result.data.shop_description) ||
          `Shop ${result.data.shop_name} on ${BRAND_NAME} — browse products from this women-led business.`,
        image: result.data.logo_url ?? null,
        canonicalPath: String(commerceRoutes.shop(result.data.slug ?? slug)),
      }),
    )
  } else {
    publishSsrPageSeo(null)
  }
  return result
}
