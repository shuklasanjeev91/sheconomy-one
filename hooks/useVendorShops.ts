import { useCallback, useEffect, useState } from 'react'

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
  | 'average_rating'
  | 'total_reviews'
  | 'verified'
  | 'is_active'
  | 'created_at'
>

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
      .select(
        'id, shop_name, shop_description, logo_url, shop_currency, average_rating, total_reviews, verified, is_active, created_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (shopsError) {
      setError(shopsError.message)
      setShops([])
    } else {
      setShops(data ?? [])
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
        .select(
          'id, shop_name, shop_description, logo_url, shop_currency, average_rating, total_reviews, verified, is_active, created_at',
        )
        .maybeSingle()

      if (updateError) {
        return { error: updateError }
      }

      if (data) {
        setShops((current) => current.map((shop) => (shop.id === shopId ? data : shop)))
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
