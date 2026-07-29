import { Icons } from '~/components/ui'
import { getCountryName, resolveCountryCode } from '~/lib/geo'
import { USER_ROLES, type UserRole } from '~/lib/profile/profile.type'

import {
  ADDRESS_TYPE,
  ADDRESS_TYPE_LABELS,
  ADDRESS_TYPE_PRIORITY,
  ADDRESS_VALIDATION,
  type Address,
  type AddressFormData,
  type AddressStats,
  type AddressType,
} from '~/lib/address/address.type'

type IconType = (typeof Icons)[keyof typeof Icons]

// ============= DISPLAY =============

/** Single-line comma-separated address for cards and summaries. */
export function formatAddressString(address: Address | null | undefined): string {
  if (!address) return ''

  const countryName = getCountryName(address.country, address.country)
  const parts = [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
    address.postal_code,
    countryName !== 'India' ? countryName : null,
  ].filter(Boolean)

  return parts.join(', ')
}

/** Multi-line address block for detail views. */
export function formatAddressMultiline(address: Address | null | undefined): string {
  if (!address) return ''

  const countryName = getCountryName(address.country, address.country)
  const lines = [
    address.address_line_1,
    address.address_line_2,
    `${address.city}, ${address.state} ${address.postal_code}`,
    countryName !== 'India' ? countryName : null,
  ].filter(Boolean)

  return lines.join('\n')
}

export function getAddressTypeLabel(addressType: string | null | undefined): string {
  if (!addressType) return 'Address'
  return ADDRESS_TYPE_LABELS[addressType as AddressType] ?? addressType
}

/** Icon component for each address type (Tamagui lucide set). */
export function getAddressTypeIcon(addressType: string | null | undefined): IconType {
  const map: Record<AddressType, IconType> = {
    [ADDRESS_TYPE.HOME]: Icons.Home,
    [ADDRESS_TYPE.WORK]: Icons.Building2,
    [ADDRESS_TYPE.SHIPPING]: Icons.Package,
    [ADDRESS_TYPE.BILLING]: Icons.CreditCard,
    [ADDRESS_TYPE.BUSINESS]: Icons.Store,
  }
  return map[addressType as AddressType] ?? Icons.MapPin
}

/** Short label + city/state for list subtitles. */
export function createAddressSummary(address: Address | null | undefined): string {
  if (!address) return ''
  const label = address.address_label?.trim() || getAddressTypeLabel(address.address_type)
  return `${label} — ${address.city}, ${address.state}`
}

// ============= SORT / GROUP / SEARCH =============

/** Default-first, then by type priority, then newest. */
export function sortAddressesByPriority(addresses: Address[]): Address[] {
  return [...addresses].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1
    if (!a.is_default && b.is_default) return 1

    const aPriority = ADDRESS_TYPE_PRIORITY[a.address_type as AddressType] ?? 999
    const bPriority = ADDRESS_TYPE_PRIORITY[b.address_type as AddressType] ?? 999
    if (aPriority !== bPriority) return aPriority - bPriority

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export function groupAddressesByType(addresses: Address[]): Partial<Record<AddressType, Address[]>> {
  return addresses.reduce<Partial<Record<AddressType, Address[]>>>((groups, address) => {
    const type = address.address_type as AddressType
    if (!groups[type]) groups[type] = []
    groups[type]!.push(address)
    return groups
  }, {})
}

export function findDefaultAddressByType(
  addresses: Address[],
  addressType: AddressType,
): Address | null {
  return addresses.find((addr) => addr.address_type === addressType && addr.is_default) ?? null
}

/** Client-side search across label, lines, city, and state. */
export function searchAddressesLocal(addresses: Address[], searchTerm: string): Address[] {
  const term = searchTerm.trim().toLowerCase()
  if (!term || term.length < ADDRESS_VALIDATION.SEARCH_MIN_LENGTH) return addresses

  return addresses.filter((address) => {
    const haystack = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
      address.address_label,
      getAddressTypeLabel(address.address_type),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(term)
  })
}

// ============= STATS =============

export function computeAddressStats(addresses: Address[]): AddressStats {
  const byType: Partial<Record<AddressType, number>> = {}
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - ADDRESS_VALIDATION.RECENT_DAYS)

  let defaultCount = 0
  let recentlyAdded = 0

  for (const address of addresses) {
    const type = address.address_type as AddressType
    byType[type] = (byType[type] ?? 0) + 1
    if (address.is_default) defaultCount += 1
    if (new Date(address.created_at) > cutoff) recentlyAdded += 1
  }

  return {
    total: addresses.length,
    byType,
    defaultCount,
    recentlyAdded,
  }
}

// ============= FORM CONVERSIONS =============

export function addressToFormData(address: Address): AddressFormData {
  return {
    address_line_1: address.address_line_1 ?? '',
    address_line_2: address.address_line_2 ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
    postal_code: address.postal_code ?? '',
    country: resolveCountryCode(address.country),
    address_type: (address.address_type as AddressType) || ADDRESS_TYPE.HOME,
    is_default: Boolean(address.is_default),
    address_label: address.address_label ?? '',
    latitude: address.latitude ?? null,
    longitude: address.longitude ?? null,
    place_id: address.place_id ?? null,
    source: (address.source as AddressFormData['source']) ?? 'manual',
  }
}

export function createEmptyAddressFormData(): AddressFormData {
  return {
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: resolveCountryCode(''),
    address_type: ADDRESS_TYPE.HOME,
    is_default: false,
    address_label: '',
    latitude: null,
    longitude: null,
    place_id: null,
    source: 'manual',
  }
}

// ============= ACCESS =============

/** Whether the signed-in user may view or mutate this address row. */
export function canManageAddress(
  address: Address,
  userId: string | null | undefined,
  role: UserRole | null | undefined,
): boolean {
  if (!userId) return false
  if (address.user_id === userId) return true
  return role === USER_ROLES.ADMIN
}

/** Whether the user can load another user's addresses (admin dashboard). */
export function canViewUserAddresses(
  targetUserId: string | null | undefined,
  viewerId: string | null | undefined,
  role: UserRole | null | undefined,
): boolean {
  if (!viewerId) return false
  if (!targetUserId || targetUserId === viewerId) return true
  return role === USER_ROLES.ADMIN
}
