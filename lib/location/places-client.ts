import { supabase } from '~/lib/supabase/client'
import { reverseGeocodeNominatim } from '~/lib/location/nominatim'

import type { LatLng, PlaceSuggestion, ResolvedAddress } from '~/lib/location/types'

type PlacesAction = 'autocomplete' | 'details' | 'geocode' | 'reverse'

type PlacesResponse<T> = {
  data: T | null
  error: string | null
  unavailable?: boolean
}

async function invokePlaces<T>(
  action: PlacesAction,
  body: Record<string, unknown>,
): Promise<PlacesResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('places', {
      body: { action, ...body },
    })

    if (error) {
      const message = error.message ?? 'Places service unavailable.'
      const unavailable =
        message.toLowerCase().includes('not found') ||
        message.toLowerCase().includes('failed to send') ||
        message.toLowerCase().includes('functionsrelayerror')
      return { data: null, error: message, unavailable }
    }

    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      return {
        data: null,
        error: String((data as { error: string }).error),
        unavailable: Boolean((data as { unavailable?: boolean }).unavailable),
      }
    }

    return { data: (data?.result ?? data) as T, error: null }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Places service unavailable.',
      unavailable: true,
    }
  }
}

export async function autocompletePlaces(
  query: string,
  options?: { country?: string; sessionToken?: string },
): Promise<PlacesResponse<PlaceSuggestion[]>> {
  const q = query.trim()
  if (q.length < 2) return { data: [], error: null }

  return invokePlaces<PlaceSuggestion[]>('autocomplete', {
    query: q,
    country: options?.country,
    sessionToken: options?.sessionToken,
  })
}

export async function getPlaceDetails(
  placeId: string,
  options?: { sessionToken?: string },
): Promise<PlacesResponse<ResolvedAddress>> {
  if (!placeId.trim()) return { data: null, error: 'Place id is required.' }
  return invokePlaces<ResolvedAddress>('details', {
    placeId,
    sessionToken: options?.sessionToken,
  })
}

export async function reverseGeocode(
  coords: LatLng,
): Promise<PlacesResponse<ResolvedAddress>> {
  const primary = await invokePlaces<ResolvedAddress>('reverse', {
    latitude: coords.latitude,
    longitude: coords.longitude,
  })
  if (primary.data) return primary

  // Places edge may be undeployed / missing Google key — fall back for display.
  const fallback = await reverseGeocodeNominatim(coords)
  if (fallback.data) {
    return { data: fallback.data, error: null, unavailable: primary.unavailable }
  }
  return {
    data: null,
    error: primary.error || fallback.error || 'Could not resolve that location.',
    unavailable: primary.unavailable,
  }
}

export async function forwardGeocode(
  address: string,
  options?: { country?: string },
): Promise<PlacesResponse<ResolvedAddress>> {
  const q = address.trim()
  if (!q) return { data: null, error: 'Address is required.' }
  return invokePlaces<ResolvedAddress>('geocode', {
    address: q,
    country: options?.country,
  })
}

export function createPlacesSessionToken(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
