import type { LatLng, ResolvedAddress } from '~/lib/location/types'

/**
 * Free reverse-geocode fallback (OpenStreetMap Nominatim) when the Places
 * edge function is unavailable or unconfigured.
 */
export async function reverseGeocodeNominatim(
  coords: LatLng,
): Promise<{ data: ResolvedAddress | null; error: string | null }> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(coords.latitude))
    url.searchParams.set('lon', String(coords.longitude))
    url.searchParams.set('zoom', '14')
    url.searchParams.set('addressdetails', '1')

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        // Nominatim usage policy requires a descriptive User-Agent.
        'User-Agent': 'SHEconomyOne/1.0 (marketplace; location display)',
      },
    })
    if (!response.ok) {
      return { data: null, error: `Nominatim error (${response.status})` }
    }

    const payload = (await response.json()) as {
      display_name?: string
      address?: Record<string, string>
    }
    const address = payload.address ?? {}
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.suburb ||
      address.county ||
      ''
    const state = address.state || address.region || ''
    const country = address.country_code?.toUpperCase() || address.country || ''
    const postal = address.postcode || ''

    if (!city && !state && !country && !payload.display_name) {
      return { data: null, error: 'No address found for that location.' }
    }

    return {
      data: {
        address_line_1: address.road || city || payload.display_name?.split(',')[0]?.trim() || '',
        address_line_2: address.suburb || address.neighbourhood || '',
        city,
        state,
        postal_code: postal,
        country,
        latitude: coords.latitude,
        longitude: coords.longitude,
        place_id: null,
        formatted: payload.display_name ?? null,
        source: 'current_location',
      },
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Nominatim reverse geocode failed.',
    }
  }
}
