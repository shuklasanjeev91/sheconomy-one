import { supabase } from '~/lib/supabase/client'

import type { LatLng, NearbyShop } from './types'

export async function fetchNearbyShops(
  coords: LatLng,
  options?: { maxDistanceKm?: number; minRating?: number },
): Promise<{ shops: NearbyShop[]; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('get_nearby_shops_with_ratings', {
      user_lat: coords.latitude,
      user_lng: coords.longitude,
      max_distance_km: options?.maxDistanceKm ?? 80,
      min_rating: options?.minRating ?? 0,
    })

    if (error) return { shops: [], error: error.message }

    const shops: NearbyShop[] = (data ?? []).map((row) => ({
      id: row.id,
      shop_name: row.shop_name,
      shop_description: row.shop_description ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      country: row.country ?? null,
      latitude: row.latitude,
      longitude: row.longitude,
      distance: row.distance,
      average_rating: row.average_rating ?? 0,
      total_reviews: row.total_reviews ?? 0,
      verified: Boolean(row.verified),
      shop_categories: Array.isArray(row.shop_categories) ? row.shop_categories : [],
    }))

    return { shops, error: null }
  } catch (error) {
    return {
      shops: [],
      error: error instanceof Error ? error.message : 'Could not load nearby shops.',
    }
  }
}
