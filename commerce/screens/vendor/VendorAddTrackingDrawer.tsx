import { useMemo, useState } from 'react'
import { Platform } from 'react-native'

import {
  Button,
  Icons,
  Image,
  Input,
  Popover,
  PopoverContent,
  ScrollView,
  Switch,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { DELIVERY_MODE, DELIVERY_MODE_OPTIONS, type DeliveryMode } from '~/lib/orders/order.constants'
import { formatOrderAmount, formatOrderDate } from '~/lib/orders/order.utils'
import {
  COURIER_OPTIONS,
  getTrackingFormat,
  validateTrackingNumber,
} from '~/lib/orders/tracking.validation'
import type { VendorOrderItem } from '~/lib/orders/vendor-orders.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const PANEL_WIDTH = 520

/** The shipping details the vendor fills in before an item can be marked shipped. */
export type TrackingFormValues = {
  courier_slug: string
  tracking_number: string
  delivery_mode: DeliveryMode
  shipping_date: string | null
  estimated_delivery_date: string | null
  custom_tracking_url: string | null
  note: string | null
  notify_customer: boolean
}

type VendorAddTrackingDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  item: VendorOrderItem | null
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TrackingFormValues) => void
}

export function VendorAddTrackingDrawer({
  ui,
  open,
  isDesktop,
  item,
  submitting,
  onClose,
  onSubmit,
}: VendorAddTrackingDrawerProps) {
  // Lock background scroll while the drawer is open (web); no-op on native.
  useLockBodyScroll(open && Boolean(item))

  if (!open || !item) return null

  // Rendered as two fixed-position siblings (backdrop + panel) with a very high
  // z-index — mirroring the proven overlay pattern used by the vendor layout and
  // ListingFiltersShell. No Portal: portaling detaches the subtree from the app's
  // renderer/context and swallows pointer events, making the drawer un-clickable.
  const panelPositionStyle =
    Platform.OS === 'web'
      ? ({ position: 'fixed' as const, top: 0, right: 0, bottom: 0, boxShadow: '-4px 0 24px rgba(0,0,0,0.18)' } as const)
      : ({ position: 'absolute' as const, top: 0, right: 0, bottom: 0 } as const)

  return (
    <>
      <YStack
        backgroundColor="rgba(0,0,0,0.5)"
        zIndex={100000}
        cursor="pointer"
        style={overlayBackdropStyle()}
        animation="quick"
        enterStyle={{ opacity: 0 }}
        onPress={submitting ? undefined : onClose}
      />
      <YStack
        width={isDesktop ? PANEL_WIDTH : '100%'}
        maxWidth="100%"
        backgroundColor={ui.background}
        borderLeftWidth={isDesktop ? 1 : 0}
        borderLeftColor={ui.borderSubtle}
        zIndex={100001}
        style={panelPositionStyle}
        animation="quick"
        enterStyle={{ x: PANEL_WIDTH }}
      >
        <TrackingForm
          ui={ui}
          item={item}
          submitting={submitting}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </YStack>
    </>
  )
}

type TrackingFormProps = {
  ui: AppUiTokens
  item: VendorOrderItem
  submitting: boolean
  onClose: () => void
  onSubmit: (values: TrackingFormValues) => void
}

function TrackingForm({ ui, item, submitting, onClose, onSubmit }: TrackingFormProps) {
  const toast = useAppToast()
  const order = item.orders
  const currency = order?.currency ?? 'INR'
  const customer = order?.profiles

  const [courierSlug, setCourierSlug] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>(DELIVERY_MODE.STANDARD)
  const [shippingDate, setShippingDate] = useState('')
  const [estimatedDelivery, setEstimatedDelivery] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [note, setNote] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [touched, setTouched] = useState(false)

  const courierLabel = useMemo(
    () => COURIER_OPTIONS.find((o) => o.value === courierSlug)?.label ?? 'Select a courier…',
    [courierSlug],
  )

  // Formatting tip based on the currently selected courier.
  const formatTip = useMemo(() => {
    if (!courierSlug) {
      return 'Enter the exact tracking ID from your courier. Incorrect formats may delay customer notifications.'
    }
    const format = getTrackingFormat(courierSlug)
    const example = format.examples[0] ? ` (e.g., ${format.examples[0]})` : ''
    return `For real-time updates, use ${format.name}'s exact format: ${format.formats.join(', ')}${example}.`
  }, [courierSlug])

  const courierError = touched && !courierSlug ? 'Courier service is required' : null
  const trackingCheck =
    trackingNumber.trim().length > 0 && courierSlug
      ? validateTrackingNumber(trackingNumber, courierSlug)
      : null
  const trackingError =
    touched && trackingNumber.trim().length === 0
      ? 'Tracking number is required'
      : trackingCheck && !trackingCheck.isValid
        ? trackingCheck.message
        : null

  const handleSubmit = () => {
    setTouched(true)
    if (!courierSlug) {
      toast.show('Courier required', { tone: 'danger', message: 'Select a courier service to continue.' })
      return
    }
    if (trackingNumber.trim().length === 0) {
      toast.show('Tracking number required', {
        tone: 'danger',
        message: 'Enter the tracking ID before marking as shipped.',
      })
      return
    }
    const validation = validateTrackingNumber(trackingNumber, courierSlug)
    if (!validation.isValid) {
      toast.show('Invalid tracking number', { tone: 'danger', message: validation.message })
      return
    }

    onSubmit({
      courier_slug: courierSlug,
      tracking_number: trackingNumber.trim(),
      delivery_mode: deliveryMode,
      shipping_date: shippingDate.trim() ? shippingDate.trim() : null,
      estimated_delivery_date: estimatedDelivery.trim() ? estimatedDelivery.trim() : null,
      custom_tracking_url: customUrl.trim() ? customUrl.trim() : null,
      note: note.trim() ? note.trim() : null,
      notify_customer: notifyCustomer,
    })
  }

  return (
    <YStack flex={1} minHeight={0}>
      {/* Header */}
      <XStack
        alignItems="flex-start"
        justifyContent="space-between"
        paddingHorizontal="$5"
        paddingTop="$4"
        paddingBottom="$3"
        gap="$2"
      >
        <YStack gap={2} flex={1} minWidth={0}>
          <Text fontSize={18} fontWeight="800" color={ui.brand}>
            Add Tracking Info
          </Text>
          <Text fontSize={12.5} color={ui.textMuted}>
            Order Ref:{' '}
            <Text fontSize={12.5} fontWeight="800" color={ui.text}>
              #{order?.order_number ?? '—'}
            </Text>
          </Text>
        </YStack>
        <YStack
          width={34}
          height={34}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          hoverStyle={{ backgroundColor: ui.surfaceMuted }}
          pressStyle={{ opacity: 0.7 }}
          onPress={submitting ? undefined : onClose}
        >
          <Icons.X size={20} color={ui.textSecondary} />
        </YStack>
      </XStack>

      <ScrollView
        flex={1}
        minHeight={0}
        showsVerticalScrollIndicator={false}
        style={
          Platform.OS === 'web'
            ? ({ overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0, flexBasis: 0 } as const)
            : undefined
        }
        contentContainerStyle={{ padding: 20, gap: 16 }}
      >
        {/* Product summary */}
        <XStack
          gap="$3"
          padding="$3"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          alignItems="center"
          style={getShadowStyle('sm')}
        >
          <YStack
            width={56}
            height={56}
            borderRadius={radius.chip}
            overflow="hidden"
            backgroundColor={ui.imagePlaceholder}
            alignItems="center"
            justifyContent="center"
          >
            {item.listing?.main_image_url ? (
              <Image source={{ uri: item.listing.main_image_url }} width={56} height={56} resizeMode="cover" />
            ) : (
              <Icons.Image size={20} color={ui.textMuted} />
            )}
          </YStack>
          <YStack flex={1} minWidth={0} gap={3}>
            <Text fontSize={13.5} fontWeight="700" color={ui.text} numberOfLines={2}>
              {item.product_title ?? item.listing?.title ?? 'Product'}
            </Text>
            <XStack gap="$3" flexWrap="wrap">
              <XStack alignItems="center" gap="$1">
                <Icons.Calendar size={12} color={ui.textMuted} />
                <Text fontSize={11.5} color={ui.textMuted}>
                  {formatOrderDate(order?.created_at ?? item.created_at)}
                </Text>
              </XStack>
              <XStack alignItems="center" gap="$1">
                <Icons.User size={12} color={ui.textMuted} />
                <Text fontSize={11.5} color={ui.textMuted} numberOfLines={1}>
                  {customer?.full_name ?? 'Customer'}
                </Text>
              </XStack>
            </XStack>
          </YStack>
          <YStack alignItems="flex-end" gap={1} borderLeftWidth={1} borderLeftColor={ui.borderSubtle} paddingLeft="$3">
            <Text fontSize={10} fontWeight="700" color={ui.textMuted} letterSpacing={0.3}>
              TOTAL
            </Text>
            <Text fontSize={14} fontWeight="800" color={ui.brand}>
              {formatOrderAmount(item.total_price, currency)}
            </Text>
          </YStack>
        </XStack>

        {/* Formatting tips */}
        <XStack
          gap="$2.5"
          padding="$3"
          borderRadius={radius.card}
          backgroundColor={ui.roseSurface}
          alignItems="flex-start"
        >
          <Icons.Info size={16} color={ui.brand} />
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={12.5} fontWeight="800" color={ui.text}>
              Formatting Tips for Faster Sync
            </Text>
            <Text fontSize={12} color={ui.textSecondary} lineHeight={17}>
              {formatTip}
            </Text>
          </YStack>
        </XStack>

        {/* Shipment details */}
        <YStack gap="$3.5">
          <Text fontSize={14} fontWeight="800" color={ui.text}>
            Shipment Details
          </Text>

          {/* Courier + delivery mode */}
          <XStack gap="$3" flexWrap="wrap">
            <YStack flex={1} minWidth={200} gap="$2">
              <FieldLabel ui={ui} label="Courier Service" required />
              <CourierPicker
                ui={ui}
                label={courierLabel}
                value={courierSlug}
                invalid={Boolean(courierError)}
                onChange={(value) => setCourierSlug(value)}
              />
              {courierError ? <FieldError text={courierError} /> : null}
            </YStack>

            <YStack flex={1} minWidth={200} gap="$2">
              <FieldLabel ui={ui} label="Delivery Mode" />
              <SegmentedModes ui={ui} value={deliveryMode} onChange={setDeliveryMode} />
            </YStack>
          </XStack>

          {/* Tracking number */}
          <YStack gap="$2">
            <FieldLabel ui={ui} label="Tracking Number" required />
            <XStack
              alignItems="center"
              gap="$2"
              paddingRight="$2"
              borderRadius="$6"
              borderWidth={trackingError ? 1.5 : 1}
              borderColor={trackingError ? ui.danger : ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              <Icons.Barcode size={16} color={ui.textMuted} style={{ marginLeft: 12 }} />
              <Input
                flex={1}
                borderWidth={0}
                backgroundColor="transparent"
                paddingHorizontal={0}
                height={46}
                placeholder="Enter AWB or tracking ID"
                autoCapitalize="characters"
                value={trackingNumber}
                onChangeText={setTrackingNumber}
              />
              <Button
                tone="ghost"
                size="$2"
                borderRadius={radius.chip}
                onPress={() =>
                  toast.show('Barcode scan coming soon', {
                    tone: 'info',
                    message: 'You will be able to scan the AWB label from your camera.',
                  })
                }
              >
                <Text fontSize={12} fontWeight="700" color={ui.textSecondary}>
                  Scan
                </Text>
              </Button>
            </XStack>
            {trackingError ? <FieldError text={trackingError} /> : null}
          </YStack>

          {/* Dates */}
          <XStack gap="$3" flexWrap="wrap">
            <YStack flex={1} minWidth={180} gap="$2">
              <FieldLabel ui={ui} label="Shipping Date" />
              <DateField ui={ui} value={shippingDate} onChange={setShippingDate} />
            </YStack>
            <YStack flex={1} minWidth={180} gap="$2">
              <FieldLabel ui={ui} label="Estimated Delivery" />
              <DateField ui={ui} value={estimatedDelivery} onChange={setEstimatedDelivery} />
            </YStack>
          </XStack>

          {/* Custom URL */}
          <YStack gap="$2">
            <FieldLabel ui={ui} label="Custom Tracking URL" optional />
            <XStack
              alignItems="center"
              gap="$2"
              borderRadius="$6"
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              <Icons.Link size={15} color={ui.textMuted} style={{ marginLeft: 12 }} />
              <Input
                flex={1}
                borderWidth={0}
                backgroundColor="transparent"
                paddingHorizontal={0}
                height={46}
                placeholder="https://"
                autoCapitalize="none"
                value={customUrl}
                onChangeText={setCustomUrl}
              />
            </XStack>
          </YStack>

          {/* Internal note */}
          <YStack gap="$2">
            <FieldLabel ui={ui} label="Internal Shipping Note" optional />
            <TextArea
              minHeight={72}
              placeholder="Add any specific instructions or notes regarding this shipment…"
              value={note}
              onChangeText={setNote}
            />
          </YStack>

          {/* Notify customer */}
          <XStack
            alignItems="center"
            justifyContent="space-between"
            gap="$3"
            padding="$3.5"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
          >
            <YStack flex={1} minWidth={0} gap={2}>
              <Text fontSize={13.5} fontWeight="800" color={ui.text}>
                Notify Customer
              </Text>
              <Text fontSize={12} color={ui.textMuted}>
                Send an automated email with tracking details.
              </Text>
            </YStack>
            <Switch checked={notifyCustomer} onCheckedChange={setNotifyCustomer}>
              <Switch.Thumb />
            </Switch>
          </XStack>
        </YStack>
      </ScrollView>

      {/* Footer */}
      <XStack
        gap="$2.5"
        justifyContent="flex-end"
        paddingHorizontal="$5"
        paddingVertical="$4"
        borderTopWidth={1}
        borderTopColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <Button tone="outline" size="$4" borderRadius={999} disabled={submitting} onPress={onClose}>
          Cancel
        </Button>
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={submitting}
          iconAfter={<Icons.Truck size={16} color={ui.onBrand} />}
          onPress={handleSubmit}
        >
          {submitting ? 'Adding…' : 'Add Tracking'}
        </Button>
      </XStack>
    </YStack>
  )
}

// ============================================================================
// Building blocks
// ============================================================================

function FieldLabel({
  ui,
  label,
  required,
  optional,
}: {
  ui: AppUiTokens
  label: string
  required?: boolean
  optional?: boolean
}) {
  return (
    <Text fontSize={12.5} fontWeight="700" color={ui.textSecondary}>
      {label}
      {required ? <Text color={ui.danger}> *</Text> : null}
      {optional ? <Text color={ui.textMuted} fontWeight="500"> (Optional)</Text> : null}
    </Text>
  )
}

function FieldError({ text }: { text: string }) {
  return (
    <Text fontSize={11.5} color="$red10" fontWeight="600">
      {text}
    </Text>
  )
}

function SegmentedModes({
  ui,
  value,
  onChange,
}: {
  ui: AppUiTokens
  value: DeliveryMode
  onChange: (mode: DeliveryMode) => void
}) {
  return (
    <XStack
      borderRadius="$6"
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
      padding={3}
      height={46}
      alignItems="center"
    >
      {DELIVERY_MODE_OPTIONS.map((mode) => {
        const active = mode.value === value
        return (
          <YStack
            key={mode.value}
            flex={1}
            height="100%"
            borderRadius={radius.chip}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            backgroundColor={active ? ui.surface : 'transparent'}
            borderWidth={active ? 1 : 0}
            borderColor={active ? ui.brand : 'transparent'}
            pressStyle={{ opacity: 0.8 }}
            onPress={() => onChange(mode.value)}
          >
            <Text fontSize={12.5} fontWeight={active ? '800' : '600'} color={active ? ui.brand : ui.textSecondary}>
              {mode.label}
            </Text>
          </YStack>
        )
      })}
    </XStack>
  )
}

function CourierPicker({
  ui,
  label,
  value,
  invalid,
  onChange,
}: {
  ui: AppUiTokens
  label: string
  value: string
  invalid?: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-start" allowFlip>
      <Popover.Trigger asChild>
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          height={46}
          borderRadius="$6"
          borderWidth={invalid ? 1.5 : 1}
          borderColor={invalid ? ui.danger : ui.borderSubtle}
          backgroundColor={ui.surface}
          cursor="pointer"
          hoverStyle={{ borderColor: ui.brand }}
          pressStyle={{ opacity: 0.85 }}
        >
          <Icons.Truck size={15} color={ui.textMuted} />
          <Text flex={1} fontSize={13} fontWeight={value ? '700' : '500'} color={value ? ui.text : ui.textMuted} numberOfLines={1}>
            {label}
          </Text>
          <Icons.ChevronDown size={15} color={ui.textMuted} />
        </XStack>
      </Popover.Trigger>
      <PopoverContent>
        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
          <YStack minWidth={220} gap={2}>
            {COURIER_OPTIONS.map((option) => {
              const selected = option.value === value
              return (
                <XStack
                  key={option.value}
                  alignItems="center"
                  justifyContent="space-between"
                  gap="$2"
                  paddingHorizontal="$3"
                  paddingVertical="$2.5"
                  borderRadius={radius.chip}
                  cursor="pointer"
                  backgroundColor={selected ? ui.roseSurface : 'transparent'}
                  hoverStyle={{ backgroundColor: ui.surfaceMuted }}
                  onPress={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Text fontSize={13} fontWeight={selected ? '800' : '600'} color={selected ? ui.brand : ui.text}>
                    {option.label}
                  </Text>
                  {selected ? <Icons.Check size={15} color={ui.brand} /> : null}
                </XStack>
              )
            })}
          </YStack>
        </ScrollView>
      </PopoverContent>
    </Popover>
  )
}

function DateField({
  ui,
  value,
  onChange,
}: {
  ui: AppUiTokens
  value: string
  onChange: (value: string) => void
}) {
  // On web, render a native date picker (returns YYYY-MM-DD, ready for the DB);
  // on native fall back to a plain text field.
  const webProps = Platform.OS === 'web' ? ({ type: 'date' } as Record<string, unknown>) : {}
  return (
    <Input
      height={46}
      placeholder="mm/dd/yyyy"
      value={value}
      onChangeText={onChange}
      color={value ? ui.text : ui.textMuted}
      {...webProps}
    />
  )
}
