import {
  AppBottomSheet,
  Button,
  Icons,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import type { Address } from '~/lib/address/address.type'
import { formatAddressString, getAddressTypeLabel } from '~/lib/address/address.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

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
  address,
  submitting,
  onClose,
  onConfirm,
}: AddressDeleteDrawerProps) {
  return (
    <AppBottomSheet
      open={open && Boolean(address)}
      onOpenChange={(next) => {
        if (!next && !submitting) onClose()
      }}
      title="Delete address?"
      scrollable={false}
      footer={
        <XStack gap="$2" width="100%">
          <Button tone="outline" size="$4" borderRadius={999} flex={1} disabled={submitting} onPress={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            flex={1}
            disabled={submitting || !address}
            onPress={onConfirm}
            icon={submitting ? <Spinner size="small" color="white" /> : <Icons.Trash2 size={16} />}
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </Button>
        </XStack>
      }
    >
      {address ? (
        <YStack gap="$4" width="100%">
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

          <Text fontSize={14} color={ui.textSecondary} textAlign="center" lineHeight={20}>
            This action cannot be undone. Orders already linked to this address are not affected.
          </Text>

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
      ) : null}
    </AppBottomSheet>
  )
}
