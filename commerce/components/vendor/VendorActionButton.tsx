import { Button, Icons } from '~/components/ui'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import type { OrderActionTone } from '~/commerce/components/vendor/vendor-order-actions'

type IconType = (typeof Icons)[keyof typeof Icons]

/**
 * The presentational slice every vendor action model shares (order status,
 * issue resolution, fulfilment steps), so one button renders them all.
 */
export type VendorActionLike = {
  label: string
  tone: OrderActionTone
  /** Lucide icon name (without the `Icon` suffix). */
  icon: string
}

type VendorActionButtonProps = {
  ui: AppUiTokens
  action: VendorActionLike
  disabled?: boolean
  flex?: number
  onPress: () => void
}

/** Renders an action with tone-aware colours (green accept, red reject, brand advance). */
export function VendorActionButton({ ui, action, disabled, flex, onPress }: VendorActionButtonProps) {
  const Icon = (Icons as Record<string, IconType>)[action.icon] ?? Icons.ArrowRight

  if (action.tone === 'success') {
    return (
      <Button
        size="$3"
        borderRadius={999}
        flex={flex}
        disabled={disabled}
        backgroundColor={ui.success}
        color={ui.onBrand}
        borderWidth={0}
        icon={<Icon size={15} color={ui.onBrand} />}
        onPress={onPress}
      >
        {action.label}
      </Button>
    )
  }

  if (action.tone === 'destructive') {
    return (
      <Button
        size="$3"
        borderRadius={999}
        flex={flex}
        tone="destructive"
        disabled={disabled}
        icon={<Icon size={15} />}
        onPress={onPress}
      >
        {action.label}
      </Button>
    )
  }

  if (action.tone === 'outline') {
    return (
      <Button
        size="$3"
        borderRadius={999}
        flex={flex}
        tone="outline"
        disabled={disabled}
        icon={<Icon size={15} />}
        onPress={onPress}
      >
        {action.label}
      </Button>
    )
  }

  return (
    <Button
      size="$3"
      borderRadius={999}
      flex={flex}
      tone="primary"
      disabled={disabled}
      icon={<Icon size={15} />}
      onPress={onPress}
    >
      {action.label}
    </Button>
  )
}
