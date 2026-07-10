import { useCallback, useEffect, useState } from 'react'

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
> & {
  address?: ShopAddress | null
}

const VENDOR_SHOP_SELECT =
  'id, shop_name, shop_description, logo_url, shop_currency, shop_email, shop_phone_number, website_url, slug, average_rating, total_reviews, verified, is_active, created_at, shop_addresses(city, state, country, postal_code)'

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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadShops = useCallback(async () => {
    if (!user) {
      setShops([])
      return
    }

    setIsLoading(true)
    setError(null)

    const { data, error: shopsError } = await supabase
      .from('shops')
      .select(VENDOR_SHOP_SELECT)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (shopsError) {
      setError(shopsError.message)
      setShops([])
    } else {
      setShops((data ?? []).map((row) => mapVendorShop(row as VendorShopRow)))
    }

    setIsLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    loadShops()
  }, [authLoading, loadShops])

  const updateShop = useCallback(
    async (
      shopId: string,
      updates: Pick<Tables<'shops'>, 'shop_name' | 'shop_description'>,
    ) => {
      if (!user) {
        return { error: new Error('You must be signed in to update a shop.') }
      }

      const { data, error: updateError } = await supabase
        .from('shops')
        .update({
          shop_name: updates.shop_name,
          shop_description: updates.shop_description,
        })
        .eq('id', shopId)
        .eq('user_id', user.id)
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
    [user],
  )

  return {
    shops,
    isLoading: authLoading || isLoading,
    error,
    isAuthenticated: !!user,
    refresh: loadShops,
    updateShop,
  }
}
