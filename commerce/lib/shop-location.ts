import { getCountryName } from '~/lib/geo'

export type ShopAddress = {
  city: string | null
  state: string | null
  country: string | null
  postal_code?: string | null
}

export type ShopOwnerProfile = {
  id: string
  full_name: string | null
  username: string
  avatar_url: string | null
  headline: string | null
  location: string | null
  is_verified: boolean
  business_name: string | null
}

export function normalizeShopAddress(value: unknown): ShopAddress | null {
  if (!value) return null
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  return row as ShopAddress
}

export function formatShopLocation(
  address?: ShopAddress | null,
  fallbackLocation?: string | null,
): string | null {
  const countryName = address?.country ? getCountryName(address.country, address.country) : null
  const parts = [address?.city, address?.state, countryName]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)

  if (parts.length) return parts.join(', ')
  return fallbackLocation?.trim() || null
}

export function formatShopCountry(address?: ShopAddress | null): string | null {
  if (!address?.country?.trim()) return null
  return getCountryName(address.country, address.country)
}
