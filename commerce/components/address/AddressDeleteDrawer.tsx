import { Platform } from 'react-native'

import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useLockBodyScroll } from '~/hooks/useLockBodyScroll'
import { overlayBackdropStyle } from '~/lib/layout/styles'
import type { Address } from '~/lib/address/address.type'
import { formatAddressString, getAddressTypeLabel } from '~/lib/address/address.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const PANEL_WIDTH = 420

type AddressDeleteDrawerProps = {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  address: Address | null
  submitting: boolean
  onClose: () => void
  onConfirm: () => void
}

export function AddressDeleteDrawer({
  ui,
  open,
  isDesktop,
  address,
  submitting,
  onClose,
  onConfirm,
}: AddressDeleteDrawerProps) {
  useLockBodyScroll(open && Boolean(address))

  if (!open || !address) return null

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
        <YStack flex={1} padding="$5" gap="$4" justifyContent="center">
          <YStack
            width={56}
            height={56}
            borderRadius={999}
            backgroundColor={ui.roseSurface}
            alignItems="center"
            justifyContent="center"
            alignSelf="center"
          >
            <Icons.AlertTriangle size={26} color={ui.brand} />
          </YStack>

          <YStack gap="$2" alignItems="center">
            <Text fontSize={20} fontWeight="800" color={ui.text} textAlign="center">
              Delete address?
            </Text>
            <Text fontSize={14} color={ui.textSecondary} textAlign="center" maxWidth={320} lineHeight={20}>
              This action cannot be undone. Orders already linked to this address are not affected.
            </Text>
          </YStack>

          <YStack
            gap="$1.5"
            padding="$4"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surfaceMuted}
          >
            <Text fontSize={14} fontWeight="700" color={ui.text}>
              {address.address_label || getAddressTypeLabel(address.address_type)}
            </Text>
            <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
              {formatAddressString(address)}
            </Text>
            {address.is_default ? (
              <Text fontSize={12} fontWeight="600" color={ui.brand}>
                This is your default {getAddressTypeLabel(address.address_type).toLowerCase()} address.
              </Text>
            ) : null}
          </YStack>
        </YStack>

        <XStack
          gap="$2"
          paddingHorizontal="$4"
          paddingVertical="$3"
          borderTopWidth={1}
          borderTopColor={ui.borderSubtle}
          backgroundColor={ui.surface}
        >
          <Button tone="outline" size="$4" borderRadius={999} flex={1} disabled={submitting} onPress={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            flex={1}
            disabled={submitting}
            onPress={onConfirm}
            icon={submitting ? <Spinner size="small" color="white" /> : <Icons.Trash2 size={16} />}
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </Button>
        </XStack>
      </YStack>
    </>
  )
}
