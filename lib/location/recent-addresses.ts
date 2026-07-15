import type { Address } from '~/lib/address/address.type'
import {
  readPersistentValue,
  writePersistentValue,
} from '~/lib/platform/storage'

const RECENT_ADDRESSES_KEY = 'sheconomy:recent-addresses'
const MAX_RECENT = 5

export type RecentAddressSnapshot = {
  id?: string
  address_line_1: string
  address_line_2?: string | null
  city: string
  state: string
  postal_code: string
  country: string
  address_label?: string | null
  address_type?: string | null
  latitude?: number | null
  longitude?: number | null
  usedAt: string
}

function fromAddress(address: Address): RecentAddressSnapshot {
  return {
    id: address.id,
    address_line_1: address.address_line_1,
    address_line_2: address.address_line_2,
    city: address.city,
    state: address.state,
    postal_code: address.postal_code,
    country: address.country,
    address_label: address.address_label,
    address_type: address.address_type,
    latitude: 'latitude' in address ? (address as Address & { latitude?: number | null }).latitude : null,
    longitude:
      'longitude' in address ? (address as Address & { longitude?: number | null }).longitude : null,
    usedAt: new Date().toISOString(),
  }
}

function sameAddress(a: RecentAddressSnapshot, b: RecentAddressSnapshot) {
  if (a.id && b.id) return a.id === b.id
  return (
    a.address_line_1 === b.address_line_1 &&
    a.postal_code === b.postal_code &&
    a.city === b.city &&
    a.country === b.country
  )
}

export async function readRecentAddresses(): Promise<RecentAddressSnapshot[]> {
  try {
    const raw = await readPersistentValue(RECENT_ADDRESSES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentAddressSnapshot[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

export async function rememberRecentAddress(
  address: Address | RecentAddressSnapshot,
): Promise<RecentAddressSnapshot[]> {
  const snapshot =
    'usedAt' in address && typeof address.usedAt === 'string'
      ? { ...address, usedAt: new Date().toISOString() }
      : fromAddress(address as Address)

  const current = await readRecentAddresses()
  const next = [snapshot, ...current.filter((item) => !sameAddress(item, snapshot))].slice(
    0,
    MAX_RECENT,
  )
  await writePersistentValue(RECENT_ADDRESSES_KEY, JSON.stringify(next))
  await writePersistentPreferredDelivery({
    postal_code: snapshot.postal_code,
    country: snapshot.country,
    city: snapshot.city,
    state: snapshot.state,
  })
  return next
}

const PREFERRED_DELIVERY_KEY = 'sheconomy:preferred-delivery'

export type PreferredDeliveryRegion = {
  postal_code: string
  country: string
  city?: string
  state?: string
}

/** Soft preference for future location-aware notifications (no background geofencing). */
export async function writePersistentPreferredDelivery(
  region: PreferredDeliveryRegion,
): Promise<void> {
  await writePersistentValue(PREFERRED_DELIVERY_KEY, JSON.stringify(region))
}

export async function readPersistentPreferredDelivery(): Promise<PreferredDeliveryRegion | null> {
  try {
    const raw = await readPersistentValue(PREFERRED_DELIVERY_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PreferredDeliveryRegion
  } catch {
    return null
  }
}
