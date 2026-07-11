import type { ComponentProps } from 'react'

import { Icons, Text, XStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type ShareActionRowProps = {
  icon: typeof Icons.Link
  label: string
  onPress: () => void
}

export function ShareActionRow({ icon: Icon, label, onPress }: ShareActionRowProps) {
  const ui = useAppUi()

  return (
    <XStack
      gap="$3"
      alignItems="center"
      paddingVertical="$3"
      paddingHorizontal="$2"
      borderRadius={10}
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      onPress={onPress}
    >
      <Icon size={20} color={ui.textSecondary} />
      <Text fontSize={15} fontWeight="500" color={ui.text}>
        {label}
      </Text>
    </XStack>
  )
}

export type ShareActionRowIcon = ComponentProps<typeof ShareActionRow>['icon']
