/** Shared location / Places types for web, iOS, and Android. */

export type LatLng = {
  latitude: number
  longitude: number
}

export type LocationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'unavailable'

export type LocationAccuracyPreference = 'approximate' | 'balanced' | 'precise'

export type PlaceSuggestion = {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
}

export type AddressSource = 'manual' | 'places' | 'current_location' | 'map'

/** Structured address returned by Places details or reverse geocode. */
export type ResolvedAddress = {
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  postal_code: string
  country: string
  latitude: number | null
  longitude: number | null
  place_id: string | null
  formatted: string | null
  source: AddressSource
}

export type CurrentPositionResult = {
  coords: LatLng | null
  accuracy: number | null
  permission: LocationPermissionStatus
  error: string | null
}

export type DeliveryAvailabilityResult = {
  available: boolean
  reason: string | null
  etaHint: string | null
  profileName: string | null
}

export type NearbyShop = {
  id: string
  shop_name: string
  shop_description: string | null
  city: string | null
  state: string | null
  country: string | null
  latitude: number
  longitude: number
  distance: number
  average_rating: number
  total_reviews: number
  verified: boolean
  shop_categories: string[]
}
