import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button, Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import type { DiscountProfile } from '~/lib/discount/discount.type'
import { DISCOUNT_UI_COPY } from '~/lib/discount/discount-ui.copy'
import { buildDiscountRowSubtitle } from '~/lib/discount/discount-ui.utils'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type DiscountListItemProps = {
  ui: AppUiTokens
  discount: DiscountProfile
  currencySymbol: string
  busy?: boolean
  onToggleActive: () => void
  onDelete: () => void
  onAssign?: (usernameOrEmail: string) => void
}

export function DiscountListItem({
  ui,
  discount,
  currencySymbol,
  busy,
  onToggleActive,
  onDelete,
  onAssign,
}: DiscountListItemProps) {
  const [assignTo, setAssignTo] = useState('')
  const codeSuffix = discount.discount_code ? ` · ${discount.discount_code}` : ''
  const subtitle = buildDiscountRowSubtitle(discount, currencySymbol)

  return (
    <YStack
      gap="$2"
      paddingVertical="$3"
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
    >
      <XStack gap="$3" alignItems="flex-start" justifyContent="space-between">
        <YStack flex={1} minWidth={0} gap="$1">
          <Text fontSize={14} fontWeight="800" color={ui.text} numberOfLines={1}>
            {discount.discount_name}
            {codeSuffix}
          </Text>
          <Text fontSize={12} color={ui.textMuted} lineHeight={18}>
            {subtitle}
          </Text>
          {discount._optimistic ? (
            <Text fontSize={11} color={ui.brand} fontWeight="700">
              Saving…
            </Text>
          ) : null}
        </YStack>
        <XStack gap="$2" flexShrink={0}>
          <Button
            tone="outline"
            size="$2"
            disabled={busy || discount._optimistic}
            onPress={onToggleActive}
          >
            {discount.is_active
              ? DISCOUNT_UI_COPY.actions.deactivate
              : DISCOUNT_UI_COPY.actions.activate}
          </Button>
          <Button
            tone="outline"
            size="$2"
            disabled={busy || discount._optimistic}
            icon={<Icons.Trash2 size={14} />}
            onPress={onDelete}
          >
            {DISCOUNT_UI_COPY.actions.delete}
          </Button>
        </XStack>
      </XStack>
      {onAssign ? (
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Input
            flex={1}
            minWidth={180}
            size="$2"
            value={assignTo}
            onChangeText={setAssignTo}
            placeholder="Assign to username or email"
          />
          <Button
            tone="outline"
            size="$2"
            disabled={busy || !assignTo.trim()}
            onPress={() => {
              onAssign(assignTo.trim())
              setAssignTo('')
            }}
          >
            Assign offer
          </Button>
        </XStack>
      ) : null}
    </YStack>
  )
}

export function DiscountListEmpty({ ui }: { ui: AppUiTokens }) {
  return (
    <YStack alignItems="center" justifyContent="center" paddingVertical="$8" gap="$2">
      <Icons.Tag size={32} color={ui.textMuted} />
      <Text fontSize={16} fontWeight="800" color={ui.text}>
        {DISCOUNT_UI_COPY.emptyList}
      </Text>
      <Text fontSize={13} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
        {DISCOUNT_UI_COPY.emptyListHint}
      </Text>
    </YStack>
  )
}

export function DiscountListPanel({
  ui,
  title,
  children,
}: {
  ui: AppUiTokens
  title: string
  children: ReactNode
}) {
  return (
    <YStack
      padding="$4"
      gap="$3"
      borderWidth={1}
      borderColor={ui.borderSubtle}
      borderRadius={radius.card}
      backgroundColor={ui.surface}
    >
      <Text fontSize={16} fontWeight="800" color={ui.text}>
        {title}
      </Text>
      {children}
    </YStack>
  )
}
