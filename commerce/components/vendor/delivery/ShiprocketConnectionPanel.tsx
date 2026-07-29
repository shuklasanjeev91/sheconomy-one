import { useState } from 'react'
import { Linking } from 'react-native'

import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { SHIPROCKET_FEATURES } from '~/lib/vendor-shipping/vendor-shipping.constants'
import { toFriendlyVendorShippingError } from '~/lib/vendor-shipping/vendor-shipping.errors'
import {
  connectShiprocketAccount,
  disconnectShiprocketAccount,
} from '~/lib/vendor-shipping/vendor-shipping.store'
import type { ShiprocketStatus, VendorShippingAccessContext } from '~/lib/vendor-shipping/vendor-shipping.type'
import { VENDOR_SHIPPING_UI_COPY } from '~/lib/vendor-shipping/vendor-shipping-ui.copy'
import { validateConnectShiprocket } from '~/lib/vendor-shipping/vendor-shipping.validation'
import { useAppDispatch } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ShiprocketConnectionPanelProps = {
  ui: AppUiTokens
  shopId: string
  status: ShiprocketStatus | null
  loading?: boolean
  connecting?: boolean
  disconnecting?: boolean
  compact?: boolean
  accessContext: VendorShippingAccessContext
  onStatusChange: () => void
}

export function ShiprocketConnectionPanel({
  ui,
  shopId,
  status,
  loading,
  connecting,
  disconnecting,
  compact,
  accessContext,
  onStatusChange,
}: ShiprocketConnectionPanelProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const copy = VENDOR_SHIPPING_UI_COPY.shiprocket

  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleConnect() {
    const validation = validateConnectShiprocket({ email, password })
    if (!validation.isValid) {
      toast.show('Could not connect Shiprocket', { tone: 'danger', message: validation.errors[0] })
      return
    }

    try {
      await dispatch(
        connectShiprocketAccount({
          shopId,
          email,
          password,
          accessContext,
        }),
      ).unwrap()
      toast.show('Shiprocket connected', { tone: 'success' })
      setShowForm(false)
      setEmail('')
      setPassword('')
      onStatusChange()
    } catch (error) {
      toast.show('Could not connect Shiprocket', {
        tone: 'danger',
        message: toFriendlyVendorShippingError(error),
      })
    }
  }

  async function handleDisconnect() {
    try {
      await dispatch(disconnectShiprocketAccount({ shopId, accessContext })).unwrap()
      toast.show('Shiprocket disconnected', { tone: 'success' })
      onStatusChange()
    } catch (error) {
      toast.show('Could not disconnect Shiprocket', {
        tone: 'danger',
        message: toFriendlyVendorShippingError(error),
      })
    } finally {
      setConfirmOpen(false)
    }
  }

  if (loading) {
    return (
      <YStack
        padding="$6"
        alignItems="center"
        justifyContent="center"
        gap="$3"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <Spinner size="large" />
        <Text fontSize={13} color={ui.textMuted}>
          {copy.checking}
        </Text>
      </YStack>
    )
  }

  return (
    <>
      <YStack
        gap="$4"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <XStack alignItems="flex-start" justifyContent="space-between" gap="$3">
          <XStack gap="$3" flex={1} minWidth={0}>
            <YStack
              width={44}
              height={44}
              borderRadius={12}
              backgroundColor="#FFF4E5"
              alignItems="center"
              justifyContent="center"
            >
              <Icons.Truck size={22} color="#EA580C" />
            </YStack>
            <YStack flex={1} gap="$1" minWidth={0}>
              <Text fontSize={18} fontWeight="800" color={ui.text}>
                {copy.title}
              </Text>
              <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
                {copy.subtitle}
              </Text>
            </YStack>
          </XStack>
          {status?.connected ? (
            <Badge tone="success">
              <XStack gap="$1" alignItems="center">
                <Icons.CheckCircle2 size={12} />
                <Text fontSize={11} fontWeight="700">
                  {copy.connected}
                </Text>
              </XStack>
            </Badge>
          ) : null}
        </XStack>

        {status?.connected && status.config ? (
          <YStack gap="$4">
            <XStack gap="$3" flexWrap="wrap">
              <InfoTile ui={ui} label={copy.companyId} value={String(status.config.company_id ?? 'N/A')} />
              <InfoTile
                ui={ui}
                label={copy.pickupLocation}
                value={status.config.pickup_location_id ? copy.pickupConfigured : copy.pickupNotSet}
              />
              <InfoTile ui={ui} label={copy.emailField} value={status.config.email} />
            </XStack>
            {status.config.last_sync_at ? (
              <Text fontSize={12} color={ui.textMuted}>
                {copy.lastSynced} {new Date(status.config.last_sync_at).toLocaleString()}
              </Text>
            ) : null}
            <Button tone="destructive" disabled={disconnecting} onPress={() => setConfirmOpen(true)}>
              {disconnecting ? copy.disconnecting : copy.disconnectCta}
            </Button>
          </YStack>
        ) : !showForm ? (
          <YStack gap="$4">
            <YStack gap="$2" padding="$4" borderRadius={14} backgroundColor={ui.surfaceMuted}>
              <Text fontSize={13} fontWeight="800" color={ui.text}>
                {copy.featuresTitle}
              </Text>
              {SHIPROCKET_FEATURES.map((feature) => (
                <XStack key={feature} gap="$2" alignItems="flex-start">
                  <Icons.CheckCircle2 size={15} color="#16A34A" />
                  <Text fontSize={12.5} color={ui.textSecondary} flex={1}>
                    {feature}
                  </Text>
                </XStack>
              ))}
            </YStack>
            <Text fontSize={12.5} color={ui.textSecondary} lineHeight={18}>
              {copy.signupHint}{' '}
              <Text
                fontSize={12.5}
                color={ui.brand}
                fontWeight="700"
                cursor="pointer"
                onPress={() => void Linking.openURL('https://www.shiprocket.in/')}
              >
                {copy.signupLink}
              </Text>
            </Text>
            <Button tone="primary" onPress={() => setShowForm(true)}>
              {copy.connectCta}
            </Button>
          </YStack>
        ) : (
          <YStack gap="$3">
            <Field label={copy.emailLabel}>
              <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </Field>
            <Field label={copy.passwordLabel} hint={copy.passwordHint}>
              <Input value={password} onChangeText={setPassword} secureTextEntry />
            </Field>
            <XStack gap="$2">
              <Button tone="outline" flex={1} disabled={connecting} onPress={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button tone="primary" flex={1} disabled={connecting} onPress={() => void handleConnect()}>
                {connecting ? copy.connecting : copy.connectAction}
              </Button>
            </XStack>
          </YStack>
        )}
      </YStack>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disconnect Shiprocket?"
        description={copy.disconnectConfirm}
        confirmLabel={copy.disconnectCta}
        destructive
        onConfirm={() => void handleDisconnect()}
      />
    </>
  )
}

function InfoTile({ ui, label, value }: { ui: AppUiTokens; label: string; value: string }) {
  return (
    <YStack
      flex={1}
      minWidth={140}
      padding="$3"
      gap="$1"
      borderRadius={14}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
    >
      <Text fontSize={12} color={ui.textMuted}>
        {label}
      </Text>
      <Text fontSize={14} fontWeight="800" color={ui.text}>
        {value}
      </Text>
    </YStack>
  )
}
