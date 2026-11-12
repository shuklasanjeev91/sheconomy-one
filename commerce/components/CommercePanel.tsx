import type { GetProps } from 'tamagui'

import { YStack } from '~/components/ui'
import { motion } from '~/lib/theme/motion'
import { useThemedShadowStyle } from '~/lib/theme/useThemedShadowStyle'
import { useAppUi } from '~/lib/theme/useAppUi'

/** Elevated marketplace surface for listing buy boxes, orders, and detail sections. */
export function CommercePanel({ children, ...props }: GetProps<typeof YStack>) {
  const ui = useAppUi()
  const shadow = useThemedShadowStyle('sm')

  return (
    <YStack
      gap="$3.5"
      padding="$5"
      borderRadius={16}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={shadow}
      {...motion.fadeUp}
      {...props}
    >
      {children}
    </YStack>
  )
}
