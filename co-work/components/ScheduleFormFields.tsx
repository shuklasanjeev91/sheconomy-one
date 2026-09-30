import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type ScheduleToggleRowProps = {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function ScheduleToggleRow({ label, description, checked, onCheckedChange }: ScheduleToggleRowProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      paddingVertical="$2"
      onPress={() => onCheckedChange(!checked)}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
    >
      <YStack flex={1} gap={2}>
        <Text color={coworkUi.text} fontWeight="600" fontSize={14}>
          {label}
        </Text>
        {description ? (
          <Text color={coworkUi.textMuted} fontSize={12} lineHeight={17}>
            {description}
          </Text>
        ) : null}
      </YStack>
      <YStack
        width={48}
        height={28}
        borderRadius={999}
        padding={3}
        backgroundColor={checked ? coworkUi.brand : coworkUi.border}
        alignItems={checked ? 'flex-end' : 'flex-start'}
        justifyContent="center"
        style={Platform.OS === 'web' ? { transition: 'background-color 0.2s ease' } : undefined}
      >
        <YStack width={22} height={22} borderRadius={999} backgroundColor="white" />
      </YStack>
    </XStack>
  )
}

export function ScheduleSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  return (
    <YStack gap="$3">
      <Text fontSize={12} fontWeight="800" color={coworkUi.textMuted} letterSpacing={1.1} textTransform="uppercase">
        {title}
      </Text>
      <YStack gap="$2">{children}</YStack>
    </YStack>
  )
}