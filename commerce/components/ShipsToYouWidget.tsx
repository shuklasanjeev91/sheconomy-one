import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { AppLink } from '~/components/navigation/AppLink'
import { AppBottomSheet, Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { CommerceRadio } from '~/commerce/components/commerce-ui'
import {
  fetchUserAddresses,
  type UserAddress,
} from '~/commerce/lib/addresses'
import { isValidZip } from '~/commerce/lib/delivery-zip'
import {
  estimateFromLocations,
  fetchEasyshipListingEstimate,
  type DeliveryEstimate,
  type WarehouseOrigin,
} from '~/commerce/lib/easyship-listing-rates'
import { getPostalCodeLabel, getPostalCodePlaceholder } from '~/lib/geo'
import { useOptionalUserLocation } from '~/lib/location'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type DestinationHint = {
  postalCode: string
  country: string
  city?: string | null
  state?: string | null
  latitude?: number | null
  longitude?: number | null
}

type ShipsToYouWidgetProps = {
  listingId?: string
  origin?: WarehouseOrigin | null
  country?: string
  initialZip?: string
  compact?: boolean
  /**
   * `pdp` = Amazon-style buy-box (Get it by + Deliver to).
   * `card` = bordered Ships to you panel (cart / fallback).
   */
  variant?: 'pdp' | 'card'
  onEstimate?: (estimate: DeliveryEstimate | null) => void
}

function pickDefaultAddress(rows: UserAddress[]): UserAddress | null {
  if (!rows.length) return null
  return (
    rows.find((row) => row.is_default) ??
    rows.find((row) => row.address_type === 'shipping' || row.address_type === 'home') ??
    rows[0] ??
    null
  )
}

function formatDeliverToLine(address: UserAddress): string {
  const label = address.address_label?.trim() || address.city || 'your location'
  const pin = address.postal_code?.trim()
  if (pin && address.city) return `${label} — ${address.city} ${pin}`
  if (pin) return `${label} ${pin}`
  return label
}

function destinationFromAddress(address: UserAddress): DestinationHint {
  return {
    postalCode: address.postal_code,
    country: (address.country || 'IN').toUpperCase().slice(0, 2) || 'IN',
    city: address.city,
    state: address.state,
    latitude: null,
    longitude: null,
  }
}

/** Delivery estimate + Amazon-style deliver-to on PDP (or card elsewhere). */
export function ShipsToYouWidget({
  listingId,
  origin = null,
  country = 'IN',
  initialZip = '',
  compact,
  variant = 'card',
  onEstimate,
}: ShipsToYouWidgetProps) {
  const ui = useAppUi()
  const { user } = useSupabase()
  const location = useOptionalUserLocation()
  const isPdp = variant === 'pdp'

  const [zip, setZip] = useState(initialZip || location?.postal_code || '')
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ratesNote, setRatesNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pinMode, setPinMode] = useState(false)
  const requestSeq = useRef(0)
  const seededAddressRef = useRef(false)

  const selectedAddress = useMemo(
    () => addresses.find((row) => row.id === selectedAddressId) ?? null,
    [addresses, selectedAddressId],
  )

  const resolvedCountry =
    selectedAddress?.country || country || location?.country || 'IN'

  const locationDestination = useMemo<DestinationHint>(
    () => ({
      postalCode: zip,
      country: resolvedCountry,
      city: location?.city,
      state: location?.state,
      latitude: location?.latitude,
      longitude: location?.longitude,
    }),
    [
      zip,
      resolvedCountry,
      location?.city,
      location?.state,
      location?.latitude,
      location?.longitude,
    ],
  )

  useEffect(() => {
    if (initialZip) {
      setZip(initialZip)
      return
    }
    if (selectedAddress?.postal_code) return
    if (location?.postal_code) {
      setZip((current) => current || location.postal_code || '')
    }
  }, [initialZip, location?.postal_code, selectedAddress?.postal_code])

  useEffect(() => {
    if (!user?.id) {
      setAddresses([])
      setSelectedAddressId(null)
      seededAddressRef.current = false
      setPinMode(false)
      return
    }

    let cancelled = false
    setAddressesLoading(true)
    void fetchUserAddresses(user.id)
      .then(({ addresses: rows }) => {
        if (cancelled) return
        const list = rows ?? []
        setAddresses(list)
        if (!seededAddressRef.current) {
          const preferred = pickDefaultAddress(list)
          if (preferred) {
            seededAddressRef.current = true
            setSelectedAddressId(preferred.id)
            setZip(preferred.postal_code)
            setPinMode(false)
          }
        }
      })
      .finally(() => {
        if (!cancelled) setAddressesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const applyLocalEstimate = useCallback(
    (dest: DestinationHint) => {
      const local = estimateFromLocations({
        postalCode: dest.postalCode,
        origin,
        destination: dest,
      })
      if (local) {
        setEstimate(local)
        onEstimate?.(local)
        setError(null)
      }
      return local
    },
    [origin, onEstimate],
  )

  const runEstimate = useCallback(
    async (dest: DestinationHint) => {
      setError(null)
      setRatesNote(null)
      if (!isValidZip(dest.postalCode)) {
        setEstimate(null)
        onEstimate?.(null)
        setError(`Enter a valid ${getPostalCodeLabel(dest.country || resolvedCountry)}.`)
        return
      }

      applyLocalEstimate(dest)
      if (!listingId) return

      const seq = ++requestSeq.current
      setLoading(true)
      try {
        const { estimate: result, error: rateError, ratesError } =
          await fetchEasyshipListingEstimate({
            listingId,
            postalCode: dest.postalCode,
            country: dest.country || resolvedCountry,
            city: dest.city,
            state: dest.state,
            latitude: dest.latitude,
            longitude: dest.longitude,
            originFallback: origin,
          })
        if (seq !== requestSeq.current) return
        if (result) {
          setEstimate(result)
          onEstimate?.(result)
          setError(null)
          setRatesNote(ratesError)
          return
        }
        if (rateError) setRatesNote(rateError)
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    },
    [applyLocalEstimate, listingId, onEstimate, origin, resolvedCountry],
  )

  useEffect(() => {
    if (selectedAddress && !pinMode) {
      void runEstimate(destinationFromAddress(selectedAddress))
      return
    }
    const seed = initialZip || zip || location?.postal_code
    if (!seed || !isValidZip(seed)) return
    void runEstimate({
      ...locationDestination,
      postalCode: seed,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed when location/address/origin arrives
  }, [
    listingId,
    initialZip,
    pinMode,
    selectedAddressId,
    selectedAddress?.postal_code,
    selectedAddress?.city,
    selectedAddress?.state,
    selectedAddress?.country,
    location?.postal_code,
    location?.city,
    location?.state,
    location?.latitude,
    location?.longitude,
    origin?.city,
    origin?.state,
    origin?.postalCode,
    origin?.latitude,
    origin?.longitude,
  ])

  const showAddressMode = Boolean(user?.id) && !pinMode
  const hasSavedAddresses = addresses.length > 0

  function selectAddress(address: UserAddress) {
    setSelectedAddressId(address.id)
    setZip(address.postal_code)
    setPinMode(false)
    setPickerOpen(false)
    void runEstimate(destinationFromAddress(address))
  }

  function usePinInstead() {
    setSelectedAddressId(null)
    setPinMode(true)
    setPickerOpen(false)
  }

  function openAddressPicker() {
    if (!user?.id) {
      setPinMode(true)
      return
    }
    setPickerOpen(true)
  }

  const deliverToLabel = selectedAddress
    ? formatDeliverToLine(selectedAddress)
    : addressesLoading
      ? 'Loading…'
      : hasSavedAddresses
        ? 'Choose a delivery address'
        : location?.city && zip
          ? `${location.city} ${zip}`
          : zip
            ? `PIN ${zip}`
            : 'Select a delivery location'

  const estimateBlock = estimate ? (
    <YStack gap={isPdp ? 2 : 4}>
      <XStack alignItems="center" gap="$2">
        <Icons.CheckCircle size={isPdp ? 16 : 15} color={ui.success} />
        <Text
          fontSize={isPdp ? 14 : 13}
          fontWeight="700"
          color={ui.success}
          flex={1}
        >
          {estimate.label}
        </Text>
      </XStack>
      {estimate.detail ? (
        <Text fontSize={12} color={ui.textMuted} paddingLeft={isPdp ? 24 : 0}>
          {estimate.detail}
        </Text>
      ) : null}
      {ratesNote && estimate.source === 'location' ? (
        <Text fontSize={11} color={ui.textMuted} paddingLeft={isPdp ? 24 : 0}>
          Shipping cost confirmed at checkout.
        </Text>
      ) : null}
    </YStack>
  ) : null

  const indiaPin = resolvedCountry.toUpperCase() === 'IN'
  const pinRow = (
    <XStack gap="$2" alignItems="center" flexWrap="wrap" width="100%">
      <Input
        flex={1}
        minWidth={120}
        height={isPdp ? 40 : 44}
        value={zip}
        onChangeText={setZip}
        placeholder={getPostalCodePlaceholder(resolvedCountry)}
        autoComplete={Platform.OS === 'web' ? ('postal-code' as never) : undefined}
        textContentType={Platform.OS === 'ios' ? 'postalCode' : undefined}
        keyboardType={indiaPin ? 'number-pad' : 'default'}
        returnKeyType="done"
        onSubmitEditing={() =>
          void runEstimate({ ...locationDestination, postalCode: zip })
        }
      />
      <XStack
        height={isPdp ? 40 : 44}
        paddingHorizontal={16}
        borderRadius={999}
        backgroundColor={ui.brand}
        alignItems="center"
        justifyContent="center"
        opacity={loading ? 0.7 : 1}
        cursor="pointer"
        accessibilityRole="button"
        accessibilityLabel={loading ? 'Checking delivery' : 'Check delivery'}
        pressStyle={{ opacity: 0.85 }}
        hitSlop={8}
        onPress={() => {
          if (!loading) void runEstimate({ ...locationDestination, postalCode: zip })
        }}
      >
        <Text fontSize={13} fontWeight="700" color={ui.onBrand}>
          {loading ? 'Checking…' : 'Check'}
        </Text>
      </XStack>
    </XStack>
  )

  const addressPickerSheet = (
    <AppBottomSheet
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      title="Choose delivery address"
      fitContent={addresses.length <= 3}
    >
      <YStack gap="$3" paddingBottom="$2">
        {addressesLoading ? (
          <Text fontSize={13} color={ui.textSecondary}>
            Loading your addresses…
          </Text>
        ) : null}
        {!addressesLoading && addresses.length === 0 ? (
          <YStack gap="$2">
            <Text fontSize={13} color={ui.textSecondary}>
              You don’t have a saved delivery address yet.
            </Text>
            <AppLink href={commerceRoutes.addresses} asChild>
              <Text fontSize={13} fontWeight="700" color={ui.brand} cursor="pointer">
                + Add a delivery address
              </Text>
            </AppLink>
          </YStack>
        ) : null}
        {addresses.map((address) => {
          const selected = selectedAddressId === address.id
          return (
            <XStack
              key={address.id}
              gap="$3"
              padding="$3"
              minHeight={56}
              borderRadius={10}
              borderWidth={1}
              borderColor={selected ? ui.brand : ui.panelBorder}
              backgroundColor={selected ? ui.surfaceMuted : ui.panelBg}
              cursor="pointer"
              accessibilityRole="button"
              accessibilityState={{ selected }}
              pressStyle={{ opacity: 0.9 }}
              onPress={() => selectAddress(address)}
            >
              <YStack paddingTop={2}>
                <CommerceRadio selected={selected} />
              </YStack>
              <YStack flex={1} gap={3} minWidth={0}>
                <XStack gap="$2" alignItems="center" flexWrap="wrap">
                  <Text fontSize={14} fontWeight="700" color={ui.text}>
                    {address.address_label || 'Delivery address'}
                  </Text>
                  {address.is_default ? (
                    <XStack
                      paddingHorizontal={8}
                      paddingVertical={2}
                      borderRadius={999}
                      backgroundColor={ui.roseSurface}
                    >
                      <Text fontSize={10} fontWeight="700" color={ui.brand}>
                        Default
                      </Text>
                    </XStack>
                  ) : null}
                </XStack>
                <Text fontSize={12} color={ui.textSecondary}>
                  {address.address_line_1}
                  {address.address_line_2 ? `, ${address.address_line_2}` : ''}
                </Text>
                <Text fontSize={12} color={ui.textSecondary}>
                  {address.city}, {address.state} {address.postal_code}
                </Text>
              </YStack>
            </XStack>
          )
        })}

        <YStack gap="$2" paddingTop="$1">
          <Text
            fontSize={13}
            fontWeight="700"
            color={ui.brand}
            cursor="pointer"
            onPress={usePinInstead}
          >
            Enter a pin code instead
          </Text>
          <AppLink href={commerceRoutes.addresses} asChild>
            <Text fontSize={13} color={ui.link} cursor="pointer">
              Manage addresses
            </Text>
          </AppLink>
        </YStack>
      </YStack>
    </AppBottomSheet>
  )

  // ─── Amazon-style PDP buy-box ───────────────────────────────────────────────
  if (isPdp) {
    return (
      <YStack gap="$2.5" width="100%">
        {estimateBlock}

        {error ? (
          <Text fontSize={12} color={ui.danger}>
            {error}
          </Text>
        ) : null}

        {showAddressMode ? (
          <XStack
            alignItems="center"
            gap="$2"
            alignSelf="stretch"
            width="100%"
            minHeight={44}
            paddingVertical={8}
            paddingHorizontal={2}
            cursor="pointer"
            accessibilityRole="button"
            accessibilityLabel={`Deliver to ${deliverToLabel}. Change delivery address.`}
            pressStyle={{ opacity: 0.75 }}
            hoverStyle={{ opacity: 0.85 }}
            hitSlop={6}
            onPress={openAddressPicker}
          >
            <Icons.MapPin size={16} color={ui.brand} />
            <YStack flex={1} minWidth={0} gap={1}>
              <Text fontSize={12} color={ui.textSecondary}>
                Deliver to
              </Text>
              <Text fontSize={14} fontWeight="700" color={ui.brand} numberOfLines={2}>
                {deliverToLabel}
              </Text>
            </YStack>
            <Icons.ChevronDown size={16} color={ui.brand} />
          </XStack>
        ) : (
          <YStack gap="$2" width="100%">
            <Text fontSize={12} color={ui.textSecondary}>
              {user?.id
                ? `Enter ${getPostalCodeLabel(resolvedCountry).toLowerCase()} for delivery`
                : `Enter your ${getPostalCodeLabel(resolvedCountry).toLowerCase()} for delivery`}
            </Text>
            {pinRow}
            {user?.id ? (
              <Text
                fontSize={13}
                fontWeight="700"
                color={ui.brand}
                cursor="pointer"
                accessibilityRole="button"
                pressStyle={{ opacity: 0.7 }}
                onPress={() => {
                  setPinMode(false)
                  openAddressPicker()
                }}
              >
                {hasSavedAddresses ? 'Deliver to a saved address' : 'Add a delivery address'}
              </Text>
            ) : null}
          </YStack>
        )}

        {addressPickerSheet}
      </YStack>
    )
  }

  // ─── Card variant (cart / compact panels) ───────────────────────────────────
  return (
    <YStack
      gap={compact ? '$2' : '$3'}
      width="100%"
      padding={compact ? '$3' : '$4'}
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.panelBorder}
      backgroundColor={ui.panelBg}
    >
      <XStack alignItems="center" gap="$2">
        <Icons.Truck size={16} color={ui.text} />
        <Text fontSize={14} fontWeight="700" color={ui.text}>
          Ships to you
        </Text>
      </XStack>

      {showAddressMode ? (
        <YStack gap="$2">
          <Text fontSize={12} color={ui.textSecondary}>
            Delivery estimate for your selected address.
          </Text>
          <XStack
            alignItems="center"
            gap="$2"
            minHeight={48}
            paddingVertical={10}
            paddingHorizontal={12}
            borderRadius={10}
            borderWidth={1}
            borderColor={ui.panelBorder}
            backgroundColor={ui.surfaceMuted}
            cursor="pointer"
            opacity={addressesLoading ? 0.7 : 1}
            accessibilityRole="button"
            accessibilityLabel={`Deliver to ${deliverToLabel}. Change delivery address.`}
            pressStyle={{ opacity: 0.85 }}
            hitSlop={6}
            onPress={openAddressPicker}
          >
            <Icons.MapPin size={16} color={ui.brand} />
            <YStack flex={1} gap={2} minWidth={0}>
              <Text fontSize={11} color={ui.textMuted} fontWeight="600">
                Deliver to
              </Text>
              <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={2}>
                {deliverToLabel}
              </Text>
            </YStack>
            <Text fontSize={13} fontWeight="700" color={ui.brand}>
              Change
            </Text>
            <Icons.ChevronDown size={16} color={ui.brand} />
          </XStack>
        </YStack>
      ) : (
        <YStack gap="$2">
          <Text fontSize={12} color={ui.textSecondary}>
            {listingId
              ? `Enter your ${getPostalCodeLabel(resolvedCountry).toLowerCase()} for a delivery estimate.`
              : 'Live delivery rates are calculated at checkout.'}
          </Text>
          {pinRow}
          {user?.id ? (
            <Text
              fontSize={12}
              fontWeight="600"
              color={ui.brand}
              cursor="pointer"
              onPress={() => {
                setPinMode(false)
                openAddressPicker()
              }}
            >
              {hasSavedAddresses ? 'Choose a saved address' : 'Add a delivery address'}
            </Text>
          ) : null}
        </YStack>
      )}

      {error ? (
        <Text fontSize={12} color={ui.danger}>
          {error}
        </Text>
      ) : null}
      {estimateBlock}

      {addressPickerSheet}
    </YStack>
  )
}
