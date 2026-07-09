import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingSidePanelProps = {
  children: ReactNode
  fullWidth?: boolean
}

/** Chat / people panel — docked right on desktop, full-width sheet on mobile. */
export function MeetingSidePanel({ children, fullWidth }: MeetingSidePanelProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  if (fullWidth) {
    return (
      <YStack
        position="absolute"
        left={0}
        right={0}
        bottom={0}
        top={0}
        zIndex={30}
        backgroundColor={coworkUi.surface}
        borderTopWidth={1}
        borderTopColor={coworkUi.borderAccent}
        pointerEvents="auto"
        {...(Platform.OS === 'web' ? { style: { boxShadow: '0 -12px 48px rgba(208, 16, 96, 0.12)' } } : {})}
      >
        {children}
      </YStack>
    )
  }

  return (
    <YStack
      pointerEvents="auto"
      height="100%"
      maxHeight="100%"
      zIndex={30}
      alignSelf="stretch"
      borderLeftWidth={1}
      borderLeftColor={coworkUi.borderAccent}
      backgroundColor={coworkUi.surface}
      style={Platform.OS === 'web' ? { boxShadow: '-8px 0 32px rgba(0,0,0,0.2)' } : undefined}
    >
      {children}
    </YStack>
  )
}