import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { Address } from '~/lib/address/address.type'
import {
  createAddressSummary,
  formatAddressMultiline,
  getAddressTypeIcon,
  getAddressTypeLabel,
} from '~/lib/address/address.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type AddressListProps = {
  ui: AppUiTokens
  addresses: Address[]
  loading?: boolean
  isDesktop?: boolean
  emptyMessage?: string
  onEdit: (address: Address) => void
  onSetDefault: (address: Address) => void
  onDelete: (address: Address) => void
}

export function AddressList({
  ui,
  addresses,
  loading = false,
  isDesktop = true,
  emptyMessage = 'No addresses found',
  onEdit,
  onSetDefault,
  onDelete,
}: AddressListProps) {
  if (loading) {
    return (
      <YStack alignItems="center" paddingVertical="$8">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (addresses.length === 0) {
    return (
      <YStack alignItems="center" gap="$3" paddingVertical="$8">
        <YStack
          width={56}
          height={56}
          borderRadius={999}
          backgroundColor={ui.chip}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.MapPin size={26} color={ui.brand} />
        </YStack>
        <Text fontSize={14} color={ui.textSecondary} textAlign="center">
          {emptyMessage}
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      {addresses.map((address) => (
        <AddressRow
          key={address.id}
          ui={ui}
          address={address}
          isDesktop={isDesktop}
          onEdit={() => onEdit(address)}
          onSetDefault={() => onSetDefault(address)}
          onDelete={() => onDelete(address)}
        />
      ))}
    </YStack>
  )
}

function AddressRow({
  ui,
  address,
  isDesktop,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  ui: AppUiTokens
  address: Address
  isDesktop: boolean
  onEdit: () => void
  onSetDefault: () => void
  onDelete: () => void
}) {
  const Icon = getAddressTypeIcon(address.address_type)

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack gap="$3" alignItems="flex-start">
        <YStack
          width={42}
          height={42}
          borderRadius={radius.chip}
          backgroundColor={ui.roseSurface}
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon size={20} color={ui.brand} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5">
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Text fontSize={15} fontWeight="800" color={ui.text}>
              {address.address_label || getAddressTypeLabel(address.address_type)}
            </Text>
            {address.is_default ? (
              <XStack
                paddingHorizontal="$2"
                paddingVertical={2}
                borderRadius={999}
                backgroundColor={ui.chip}
                alignItems="center"
                gap={4}
              >
                <Icons.Star size={11} color={ui.brand} />
                <Text fontSize={10} fontWeight="700" color={ui.brand}>
                  Default
                </Text>
              </XStack>
            ) : null}
          </XStack>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
            {formatAddressMultiline(address)}
          </Text>
          <Text fontSize={11.5} color={ui.textMuted}>
            {createAddressSummary(address)}
          </Text>
        </YStack>
      </XStack>

      <XStack
        gap="$2"
        flexWrap="wrap"
        justifyContent={isDesktop ? 'flex-end' : 'flex-start'}
      >
        <Button tone="outline" size="$2" borderRadius={999} onPress={onEdit}>
          Edit
        </Button>
        {!address.is_default ? (
          <Button tone="outline" size="$2" borderRadius={999} onPress={onSetDefault}>
            Set default
          </Button>
        ) : null}
        <Button tone="outline" size="$2" borderRadius={999} onPress={onDelete}>
          Delete
        </Button>
      </XStack>
    </YStack>
  )
}
