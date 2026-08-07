import { useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

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
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import { formatOrderAmount } from '~/lib/orders/order.utils'
import {
  COURIER_OPTIONS,
  getTrackingFormat,
  validateTrackingNumber,
} from '~/lib/orders/tracking.validation'
import type { VendorOrderItem } from '~/lib/orders/vendor-orders.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const PANEL_WIDTH = 440

/** Minimal tracking payload — courier + AWB. ETA/status come from the carrier. */
export type TrackingFormValues = {
  courier_slug: string
  tracking_number: string
  custom_tracking_url: string | null
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
  useLockBodyScroll(open && Boolean(item))

  if (!open || !item) return null

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
  const { resolveCurrency } = useVendorCurrency()
  const currency = resolveCurrency(order?.currency)
  const customer = order?.profiles

  const [courierSlug, setCourierSlug] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [touched, setTouched] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  async function openBarcodeScanner() {
    if (Platform.OS === 'web') {
      toast.show('Barcode scan is available in the mobile app', {
        tone: 'info',
        message: 'On iOS/Android, Scan opens the camera to read AWB barcodes.',
      })
      return
    }
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission()
      if (!result.granted) {
        toast.show('Camera permission needed', {
          tone: 'danger',
          message: 'Allow camera access to scan tracking barcodes.',
        })
        return
      }
    }
    setScanning(true)
  }

  const courierLabel = useMemo(
    () => COURIER_OPTIONS.find((o) => o.value === courierSlug)?.label ?? 'Select courier…',
    [courierSlug],
  )
  const awbEnabled = Boolean(courierSlug)

  const formatHint = useMemo(() => {
    if (!courierSlug) return null
    const format = getTrackingFormat(courierSlug)
    const example = format.examples[0] ? ` · e.g. ${format.examples[0]}` : ''
    return `${format.formats.join(' or ')}${example}`
  }, [courierSlug])

  const courierError = touched && !courierSlug ? 'Select a courier' : null
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
      toast.show('Courier required', { tone: 'danger', message: 'Select a courier to continue.' })
      return
    }
    if (trackingNumber.trim().length === 0) {
      toast.show('Tracking number required', {
        tone: 'danger',
        message: 'Enter the AWB from your courier label.',
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
      custom_tracking_url: null,
      notify_customer: notifyCustomer,
    })
  }

  return (
    <YStack flex={1} minHeight={0}>
      <XStack
        alignItems="flex-start"
        justifyContent="space-between"
        paddingHorizontal="$5"
        paddingTop="$4"
        paddingBottom="$3"
        gap="$2"
        borderBottomWidth={1}
        borderBottomColor={ui.borderSubtle}
      >
        <YStack gap={4} flex={1} minWidth={0}>
          <Text fontSize={18} fontWeight="800" color={ui.text}>
            Add tracking
          </Text>
          <Text fontSize={12.5} color={ui.textMuted} lineHeight={18}>
            Order #{order?.order_number ?? '—'} · Book with your courier, then paste the AWB
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
        contentContainerStyle={{ padding: 20, gap: 18 }}
      >
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
            width={48}
            height={48}
            borderRadius={radius.chip}
            overflow="hidden"
            backgroundColor={ui.imagePlaceholder}
            alignItems="center"
            justifyContent="center"
          >
            {item.listing?.main_image_url ? (
              <Image source={{ uri: item.listing.main_image_url }} width={48} height={48} resizeMode="cover" />
            ) : (
              <Icons.Package size={18} color={ui.textMuted} />
            )}
          </YStack>
          <YStack flex={1} minWidth={0} gap={2}>
            <Text fontSize={13.5} fontWeight="700" color={ui.text} numberOfLines={1}>
              {item.product_title ?? item.listing?.title ?? 'Product'}
            </Text>
            <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
              {customer?.full_name ?? 'Customer'} · {formatOrderAmount(item.total_price, currency)}
            </Text>
          </YStack>
        </XStack>

        <YStack gap="$2.5">
          <StepLabel ui={ui} step={1} label="Courier" />
          <CourierPicker
            ui={ui}
            label={courierLabel}
            value={courierSlug}
            invalid={Boolean(courierError)}
            onChange={(value) => {
              setCourierSlug(value)
              setTrackingNumber('')
            }}
          />
          {courierError ? <FieldError text={courierError} /> : null}
        </YStack>

        <YStack gap="$2.5" opacity={awbEnabled ? 1 : 0.55}>
          <StepLabel ui={ui} step={2} label="Tracking number (AWB)" />
          <XStack
            alignItems="center"
            gap="$2"
            paddingRight="$2"
            borderRadius="$6"
            borderWidth={trackingError ? 1.5 : 1}
            borderColor={trackingError ? ui.danger : ui.borderSubtle}
            backgroundColor={awbEnabled ? ui.surface : ui.surfaceMuted}
          >
            <Icons.Barcode size={16} color={ui.textMuted} style={{ marginLeft: 12 }} />
            <Input
              flex={1}
              borderWidth={0}
              backgroundColor="transparent"
              paddingHorizontal={0}
              height={48}
              placeholder={awbEnabled ? 'Paste or scan AWB' : 'Select a courier first'}
              autoCapitalize="characters"
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              editable={awbEnabled && !submitting}
              disabled={!awbEnabled}
            />
            <Button
              tone="ghost"
              size="$2"
              borderRadius={radius.chip}
              disabled={!awbEnabled || submitting}
              onPress={() => void openBarcodeScanner()}
            >
              <Text fontSize={12} fontWeight="700" color={ui.textSecondary}>
                Scan
              </Text>
            </Button>
          </XStack>
          {formatHint ? (
            <Text fontSize={11.5} color={ui.textMuted}>
              Format: {formatHint}
            </Text>
          ) : (
            <Text fontSize={11.5} color={ui.textMuted}>
              Delivery date and status sync from the courier — no need to enter them here.
            </Text>
          )}
          {trackingError ? <FieldError text={trackingError} /> : null}

          {scanning && Platform.OS !== 'web' ? (
            <YStack
              height={220}
              borderRadius={radius.card}
              overflow="hidden"
              borderWidth={1}
              borderColor={ui.borderSubtle}
              position="relative"
            >
              <CameraView
                style={{ flex: 1, width: '100%', height: '100%' }}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'qr', 'upc_a', 'upc_e'],
                }}
                onBarcodeScanned={(event) => {
                  const value = event.data?.trim()
                  if (!value) return
                  setTrackingNumber(value)
                  setScanning(false)
                  toast.show('Barcode scanned', { tone: 'success' })
                }}
              />
              <Button
                position="absolute"
                top={8}
                right={8}
                size="$2"
                onPress={() => setScanning(false)}
              >
                <Text>Close</Text>
              </Button>
            </YStack>
          ) : null}
        </YStack>

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
            <Text fontSize={13.5} fontWeight="700" color={ui.text}>
              Notify customer
            </Text>
            <Text fontSize={12} color={ui.textMuted} lineHeight={17}>
              Send updates when shipped and as the courier advances the package.
            </Text>
          </YStack>
          <Switch checked={notifyCustomer} onCheckedChange={setNotifyCustomer} />
        </XStack>
      </ScrollView>

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
          {submitting ? 'Saving…' : 'Save tracking'}
        </Button>
      </XStack>
    </YStack>
  )
}

function StepLabel({ ui, step, label }: { ui: AppUiTokens; step: number; label: string }) {
  return (
    <XStack alignItems="center" gap="$2">
      <YStack
        width={22}
        height={22}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.brand}
      >
        <Text fontSize={11} fontWeight="800" color={ui.onBrand}>
          {step}
        </Text>
      </YStack>
      <Text fontSize={13} fontWeight="700" color={ui.text}>
        {label}
      </Text>
    </XStack>
  )
}

function FieldError({ text }: { text: string }) {
  return (
    <Text fontSize={11.5} color="$red10" fontWeight="600">
      {text}
    </Text>
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
          height={48}
          borderRadius="$6"
          borderWidth={invalid ? 1.5 : 1}
          borderColor={invalid ? ui.danger : ui.borderSubtle}
          backgroundColor={ui.surface}
          cursor="pointer"
          hoverStyle={{ borderColor: ui.brand }}
          pressStyle={{ opacity: 0.85 }}
        >
          <Icons.Truck size={15} color={ui.textMuted} />
          <Text
            flex={1}
            fontSize={14}
            fontWeight={value ? '700' : '500'}
            color={value ? ui.text : ui.textMuted}
            numberOfLines={1}
          >
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
