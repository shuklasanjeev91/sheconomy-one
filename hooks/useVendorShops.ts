import { useCallback, useEffect, useRef, useState } from 'react'

import { normalizeVendorShopAddress } from '~/commerce/lib/shop-address'
import type { ShopAddress } from '~/commerce/lib/shop-location'
import { supabase } from '~/lib/supabase'
import type { Tables } from '~/lib/supabase'
import { useSupabase } from '~/providers/SupabaseProvider'

export type VendorShop = Pick<
  Tables<'shops'>,
  | 'id'
  | 'shop_name'
  | 'shop_description'
  | 'logo_url'
  | 'shop_currency'
  | 'shop_email'
  | 'shop_phone_number'
  | 'website_url'
  | 'slug'
  | 'average_rating'
  | 'total_reviews'
  | 'verified'
  | 'is_active'
  | 'created_at'
  | 'shop_metadata'
> & {
  address?: ShopAddress | null
}

const VENDOR_SHOP_SELECT =
  'id, shop_name, shop_description, logo_url, shop_currency, shop_email, shop_phone_number, website_url, slug, average_rating, total_reviews, verified, is_active, created_at, shop_metadata, shop_addresses(city, state, country, postal_code)'

const SHOPS_FETCH_TIMEOUT_MS = 6_000

type VendorShopRow = Omit<VendorShop, 'address'> & {
  shop_addresses?: unknown
}

function mapVendorShop(row: VendorShopRow): VendorShop {
  const { shop_addresses, ...shop } = row
  return {
    ...shop,
    address: normalizeVendorShopAddress(shop_addresses),
  }
}

export function useVendorShops() {
  const { user, isLoading: authLoading } = useSupabase()
  const [shops, setShops] = useState<VendorShop[]>([])
  const [shopsUserId, setShopsUserId] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchGen = useRef(0)

  const userId = user?.id ?? null
  const shopsMatchUser = !!userId && shopsUserId === userId

  const loadShops = useCallback(async () => {
    if (!userId) {
      fetchGen.current += 1
      setShops([])
      setShopsUserId(null)
      setError(null)
      setFetching(false)
      return
    }

    const gen = ++fetchGen.current
    setFetching(true)
    setError(null)

    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      if (fetchGen.current !== gen) return
      setError('Shop list timed out')
      setShops([])
      setShopsUserId(userId)
      setFetching(false)
    }, SHOPS_FETCH_TIMEOUT_MS)

    try {
      const { data, error: shopsError } = await supabase
        .from('shops')
        .select(VENDOR_SHOP_SELECT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (fetchGen.current !== gen || timedOut) return

      if (shopsError) {
        setError(shopsError.message)
        setShops([])
      } else {
        setShops((data ?? []).map((row) => mapVendorShop(row as VendorShopRow)))
      }
      setShopsUserId(userId)
    } finally {
      clearTimeout(timeout)
      if (fetchGen.current === gen && !timedOut) {
        setFetching(false)
      }
    }
  }, [userId])

  useEffect(() => {
    if (authLoading) return
    void loadShops()
  }, [authLoading, loadShops])

  const updateShop = useCallback(
    async (
      shopId: string,
      updates: Pick<Tables<'shops'>, 'shop_name' | 'shop_description'>,
    ) => {
      if (!userId) {
        return { error: new Error('You must be signed in to update a shop.') }
      }

      const { data, error: updateError } = await supabase
        .from('shops')
        .update({
          shop_name: updates.shop_name,
          shop_description: updates.shop_description,
        })
        .eq('id', shopId)
        .eq('user_id', userId)
        .select(VENDOR_SHOP_SELECT)
        .maybeSingle()

      if (updateError) {
        return { error: updateError }
      }

      if (data) {
        const mapped = mapVendorShop(data as VendorShopRow)
        setShops((current) => current.map((shop) => (shop.id === shopId ? mapped : shop)))
        return { data: mapped, error: null }
      }

      return { data, error: null }
    },
    [userId],
  )

  // Never report "ready with zero shops" until the first fetch for this user finishes.
  // Otherwise SellerDashboard redirects before vendor shops data lands (spinner loop).
  // Background refresh must not blank the seller hub with a full-screen spinner.
  const isLoading = authLoading || (!!userId && !shopsMatchUser)

  return {
    shops: shopsMatchUser ? shops : [],
    isLoading,
    error,
    isAuthenticated: !!user,
    primaryShopId: shopsMatchUser ? (shops[0]?.id ?? null) : null,
    isRefreshing: fetching && shopsMatchUser,
    refresh: loadShops,
    updateShop,
  }
}
