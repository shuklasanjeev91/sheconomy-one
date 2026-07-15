import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type PlacesAction = 'autocomplete' | 'details' | 'geocode' | 'reverse'

type ComponentMap = Record<string, string>

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getGoogleKey() {
  return (
    Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim() ||
    Deno.env.get('GOOGLE_PLACES_API_KEY')?.trim() ||
    ''
  )
}

function componentMap(components: Array<{ long_name: string; short_name: string; types: string[] }>) {
  const map: ComponentMap = {}
  for (const component of components ?? []) {
    for (const type of component.types) {
      if (!map[type]) map[type] = component.long_name
      map[`${type}_short`] = component.short_name
    }
  }
  return map
}

function streetLine(map: ComponentMap) {
  const number = map.street_number ?? ''
  const route = map.route ?? ''
  return [number, route].filter(Boolean).join(' ').trim()
}

function toResolved(
  result: {
    formatted_address?: string
    place_id?: string
    geometry?: { location?: { lat: number; lng: number } }
    address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
  },
  source: 'places' | 'current_location' | 'map' | 'manual',
) {
  const map = componentMap(result.address_components ?? [])
  const line1 = streetLine(map) || result.formatted_address?.split(',')[0]?.trim() || ''
  return {
    address_line_1: line1,
    address_line_2: map.sublocality || map.neighborhood || map.sublocality_level_1 || '',
    city:
      map.locality ||
      map.postal_town ||
      map.administrative_area_level_2 ||
      map.sublocality ||
      '',
    state: map.administrative_area_level_1 || '',
    postal_code: map.postal_code || '',
    country: map.country_short || map.country || '',
    latitude: result.geometry?.location?.lat ?? null,
    longitude: result.geometry?.location?.lng ?? null,
    place_id: result.place_id ?? null,
    formatted: result.formatted_address ?? null,
    source,
  }
}

async function googleGet(url: URL) {
  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`Google Places error (${response.status})`)
  }
  return response.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const key = getGoogleKey()
    if (!key) {
      return jsonResponse(
        {
          error: 'Places is not configured. Set GOOGLE_MAPS_API_KEY on the Edge Function.',
          unavailable: true,
        },
        503,
      )
    }

    const body = (await req.json()) as {
      action?: PlacesAction
      query?: string
      placeId?: string
      address?: string
      latitude?: number
      longitude?: number
      country?: string
      sessionToken?: string
    }

    const action = body.action
    if (!action) return jsonResponse({ error: 'action is required' }, 400)

    if (action === 'autocomplete') {
      const query = body.query?.trim() ?? ''
      if (query.length < 2) return jsonResponse({ result: [] })

      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
      url.searchParams.set('input', query)
      url.searchParams.set('key', key)
      url.searchParams.set('types', 'address')
      if (body.sessionToken) url.searchParams.set('sessiontoken', body.sessionToken)
      if (body.country) url.searchParams.set('components', `country:${body.country.toLowerCase()}`)

      const data = await googleGet(url)
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        return jsonResponse({ error: data.error_message || data.status }, 502)
      }

      const result = (data.predictions ?? []).map(
        (prediction: {
          place_id: string
          description: string
          structured_formatting?: { main_text?: string; secondary_text?: string }
        }) => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting?.main_text ?? prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text ?? '',
        }),
      )
      return jsonResponse({ result })
    }

    if (action === 'details') {
      const placeId = body.placeId?.trim()
      if (!placeId) return jsonResponse({ error: 'placeId is required' }, 400)

      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
      url.searchParams.set('place_id', placeId)
      url.searchParams.set('key', key)
      url.searchParams.set(
        'fields',
        'place_id,formatted_address,geometry,address_component',
      )
      if (body.sessionToken) url.searchParams.set('sessiontoken', body.sessionToken)

      const data = await googleGet(url)
      if (data.status !== 'OK') {
        return jsonResponse({ error: data.error_message || data.status }, 502)
      }
      return jsonResponse({ result: toResolved(data.result, 'places') })
    }

    if (action === 'reverse') {
      const lat = body.latitude
      const lng = body.longitude
      if (lat == null || lng == null) {
        return jsonResponse({ error: 'latitude and longitude are required' }, 400)
      }

      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
      url.searchParams.set('latlng', `${lat},${lng}`)
      url.searchParams.set('key', key)

      const data = await googleGet(url)
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        return jsonResponse({ error: data.error_message || data.status }, 502)
      }
      const first = data.results?.[0]
      if (!first) return jsonResponse({ error: 'No address found for that location.' }, 404)
      return jsonResponse({ result: toResolved(first, 'current_location') })
    }

    if (action === 'geocode') {
      const address = body.address?.trim()
      if (!address) return jsonResponse({ error: 'address is required' }, 400)

      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
      url.searchParams.set('address', address)
      url.searchParams.set('key', key)
      if (body.country) url.searchParams.set('components', `country:${body.country.toLowerCase()}`)

      const data = await googleGet(url)
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        return jsonResponse({ error: data.error_message || data.status }, 502)
      }
      const first = data.results?.[0]
      if (!first) return jsonResponse({ error: 'No match for that address.' }, 404)
      return jsonResponse({ result: toResolved(first, 'manual') })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Places request failed.' },
      500,
    )
  }
})
