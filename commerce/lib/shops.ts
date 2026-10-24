import { supabase } from '~/lib/supabase'
import { blockedContentMessage } from '~/lib/safety/content-screen'

export type CreateShopInput = {
  shopName: string
  shopDescription?: string
  shopCurrency?: string
}

export async function createSellerShop(input: CreateShopInput) {
  const blocked = await blockedContentMessage(input.shopDescription ?? '')
  if (blocked) return { shopId: null as string | null, error: blocked }
  const { data, error } = await supabase.rpc('seller_create_shop_with_points', {
    p_shop_name: input.shopName.trim(),
    p_shop_description: input.shopDescription?.trim() || undefined,
    p_shop_currency: input.shopCurrency ?? 'INR',
  })

  if (error) {
    return { shopId: null as string | null, error: error.message }
  }

  return { shopId: data as string, error: null as string | null }
}
