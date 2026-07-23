import type { ReactNode } from 'react'

import { Text, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type DiscountFormCardProps = {
  ui: AppUiTokens
  title: string
  subtitle?: string
  headerRight?: ReactNode
  children: ReactNode
}

export function DiscountFormCard({ ui, title, subtitle, headerRight, children }: DiscountFormCardProps) {
  return (
    <YStack
      gap="$3.5"
      padding="$5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <YStack gap="$1">
        <Text fontSize={15} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
          {title}
        </Text>
        {subtitle ? (
          <Text fontSize={12.5} color={ui.textMuted} lineHeight={18}>
            {subtitle}
          </Text>
        ) : null}
        {headerRight}
      </YStack>
      {children}
    </YStack>
  )
}
