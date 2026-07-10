import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type AppPageHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  /** Override accent rail color (defaults to brand). */
  accentColor?: string
  size?: 'lg' | 'md'
}

/** App-wide page title with brand accent rail. */
export function AppPageHeader({
  title,
  subtitle,
  actions,
  accentColor,
  size = 'lg',
}: AppPageHeaderProps) {
  const ui = useAppUi()
  const accent = accentColor ?? ui.brand
  const titleSize = size === 'lg' ? 28 : 24
  const railHeight = size === 'lg' ? 32 : 28

  return (
    <XStack
      justifyContent="space-between"
      alignItems="flex-start"
      gap="$3"
      flexWrap="wrap"
      width="100%"
    >
      <YStack gap="$1.5" flex={1} minWidth={0}>
        <XStack gap="$3" alignItems="center">
          <YStack
            width={4}
            height={railHeight}
            borderRadius={999}
            backgroundColor={accent}
            opacity={0.95}
            style={
              Platform.OS === 'web'
                ? ({ background: `linear-gradient(180deg, ${accent} 0%, ${accent}88 100%)` } as const)
                : undefined
            }
          />
          <Text
            fontSize={titleSize}
            fontWeight="800"
            color={ui.text}
            letterSpacing={-0.55}
            lineHeight={titleSize + 6}
          >
            {title}
          </Text>
        </XStack>
        {subtitle ? (
          <Text
            fontSize={14}
            color={ui.textMuted}
            fontWeight="500"
            paddingLeft={19}
            lineHeight={21}
          >
            {subtitle}
          </Text>
        ) : null}
      </YStack>
      {actions ? <XStack flexShrink={0}>{actions}</XStack> : null}
    </XStack>
  )
}
