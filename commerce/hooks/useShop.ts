import { useCallback, useEffect, useState } from 'react'

import { supabase } from '~/lib/supabase'
import type { Tables } from '~/lib/supabase'
import { isUuid, shopSlugMatches, slugifyTitle } from '~/commerce/lib/seo-urls'
import {
  normalizeShopAddress,
  type ShopAddress,
  type ShopOwnerProfile,
} from '~/commerce/lib/shop-location'

export type { ShopAddress, ShopOwnerProfile } from '~/commerce/lib/shop-location'

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
> & {
  owner: ShopOwnerProfile | null
  address: ShopAddress | null
}

const SHOP_SELECT = `
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

export function useShop(shopRef?: string) {
  const [shop, setShop] = useState<ShopDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!shopRef) {
      setShop(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const select = SHOP_SELECT

    let shopResult = isUuid(shopRef)
      ? await supabase.from('shops').select(select).eq('id', shopRef).maybeSingle()
      : await supabase.from('shops').select(select).eq('slug', shopRef).maybeSingle()

    if (!shopResult.data && !isUuid(shopRef)) {
      const slugGuess = shopRef.replace(/-/g, ' ')
      shopResult = await supabase
        .from('shops')
        .select(select)
        .ilike('shop_name', slugGuess)
        .maybeSingle()
    }

    if (!shopResult.data && !isUuid(shopRef)) {
      const { data: activeShops } = await supabase
        .from('shops')
        .select(select)
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
      shopResult = await supabase.from('shops').select(select).eq('id', shopRef).maybeSingle()
    }

    if (shopResult.error || !shopResult.data) {
      setError(shopResult.error?.message ?? 'Shop not found')
      setShop(null)
      setIsLoading(false)
      return
    }

    const mappedShop = mapShopRow(shopResult.data as ShopRow)
    const owner = await loadShopOwner(mappedShop.user_id)

    setShop({
      ...mappedShop,
      owner,
    })
    setIsLoading(false)
  }, [shopRef])

  useEffect(() => {
    let cancelled = false

    load().then(() => {
      if (cancelled) return
    })

    return () => {
      cancelled = true
    }
  }, [load])

  return { shop, isLoading, error, refresh: load }
}
