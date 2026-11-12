import { Icons, Text, XStack, YStack } from '~/components/ui'
import { ViewportOverlay } from '~/components/layout/ViewportOverlay'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { overlayBackdropStyle, overlayPanelStyle } from '~/lib/layout/styles'
import { PAYMENT_PROVIDERS } from '~/lib/payment/payment.constants'
import { isProviderConnected } from '~/lib/payment/payment.utils'
import type { ConnectedProviderSummary, PaymentProviderConfig, ShopPaymentAccount } from '~/lib/payment/payment.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { PaymentConnectForm } from '~/commerce/components/vendor/payment/PaymentConnectForm'

const PANEL_WIDTH = 560

type VendorPaymentConnectDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  shopId: string
  provider: PaymentProviderConfig | null
  accounts: ShopPaymentAccount[]
  connectedProviders: ConnectedProviderSummary[]
  webhookUrl?: string | null
  safeBottom: number
  onClose: () => void
  onConnected?: () => void
}

function isPlatformCollect(provider: PaymentProviderConfig): boolean {
  return (
    provider.id === PAYMENT_PROVIDERS.PAYU ||
    String(provider.id).toLowerCase() === 'payu' ||
    provider.name === 'SHEPay' ||
    provider.name === 'Online payouts'
  )
}

export function VendorPaymentConnectDrawer({
  ui,
  open,
  isDesktop,
  shopId,
  provider,
  accounts,
  connectedProviders,
  webhookUrl,
  safeBottom,
  onClose,
  onConnected,
}: VendorPaymentConnectDrawerProps) {
  useLockBodyScroll(open && Boolean(provider))

  if (!open || !provider) return null

  const connected = isProviderConnected(provider.id, accounts, connectedProviders)
  const platformCollect = isPlatformCollect(provider)
  const drawerTitle = platformCollect
    ? connected
      ? 'Your payout details'
      : 'Get paid'
    : connected
      ? `Configure ${provider.name}`
      : `Connect ${provider.name}`

  const panelPositionStyle = overlayPanelStyle()

  return (
    <ViewportOverlay>
      <YStack
        backgroundColor="rgba(0,0,0,0.5)"
        zIndex={100000}
        cursor="pointer"
        style={overlayBackdropStyle()}
        onPress={onClose}
      />
      <YStack
        width={isDesktop ? PANEL_WIDTH : '100%'}
        maxWidth="100%"
        flex={1}
        minHeight={0}
        backgroundColor={ui.background}
        borderLeftWidth={isDesktop ? 1 : 0}
        borderLeftColor={ui.borderSubtle}
        zIndex={100001}
        style={panelPositionStyle}
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <XStack alignItems="center" gap="$3" flex={1} minWidth={0}>
            <XStack
              alignItems="center"
              gap="$1.5"
              cursor="pointer"
              onPress={onClose}
              flexShrink={0}
            >
              <Icons.ArrowLeft size={16} color={ui.brand} />
              <Text fontSize={12} fontWeight="700" color={ui.brand} letterSpacing={0.3}>
                Back
              </Text>
            </XStack>
            <Text fontSize={16} fontWeight="800" color={ui.text} numberOfLines={1} flex={1}>
              {drawerTitle}
            </Text>
          </XStack>
          <YStack
            width={36}
            height={36}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            onPress={onClose}
          >
            <Icons.X size={20} color={ui.textSecondary} />
          </YStack>
        </XStack>

        <YStack
          flex={1}
          minHeight={0}
          overflow="hidden"
          paddingHorizontal="$4"
          paddingTop="$4"
          paddingBottom={16 + safeBottom}
        >
          <PaymentConnectForm
            ui={ui}
            shopId={shopId}
            provider={provider}
            connected={connected}
            initialWebhookUrl={webhookUrl}
            onClose={onClose}
            onConnected={onConnected}
          />
        </YStack>
      </YStack>
    </ViewportOverlay>
  )
}
