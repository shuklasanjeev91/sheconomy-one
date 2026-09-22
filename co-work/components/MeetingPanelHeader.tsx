import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { MeetingSheetButton } from '~/co-work/components/MeetingSheetButton'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingPanelHeaderProps = {
  title: string
  subtitle?: string
  icon?: ReactNode
  onClose: () => void
  /** Optional trailing control before the close button (e.g. Save chat). */
  trailing?: ReactNode
}

export function MeetingPanelHeader({
  title,
  subtitle,
  icon,
  onClose,
  trailing,
}: MeetingPanelHeaderProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      alignItems="center"
      justifyContent="space-between"
      borderBottomWidth={1}
      borderBottomColor={coworkUi.borderSoft}
      zIndex={4}
      style={coworkGlassStyle(coworkUi, true)}
    >
      <XStack alignItems="center" gap="$3" flex={1} pointerEvents="none">
        {icon ? (
          <YStack
            width={38}
            height={38}
            borderRadius={13}
            alignItems="center"
            justifyContent="center"
            backgroundColor={coworkUi.brandMuted}
            borderWidth={1}
            borderColor={coworkUi.borderAccent}
          >
            {icon}
          </YStack>
        ) : null}
        <YStack gap={2} flex={1}>
          <Text fontWeight="800" fontSize={15} color={coworkUi.text} letterSpacing={-0.4}>
            {title}
          </Text>
          {subtitle ? (
            <Text fontSize={11} color={coworkUi.textMuted}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      </XStack>
      <XStack alignItems="center" gap="$1.5">
        {trailing}
        {Platform.OS === 'web' ? (
          <Button
            tone="ghost"
            size="$2"
            borderRadius={999}
            width={36}
            height={36}
            padding={0}
            onPress={onClose}
            icon={<Icons.X size={18} color={coworkUi.textSecondary} />}
          />
        ) : (
          <MeetingSheetButton
            accessibilityLabel="Close panel"
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <Icons.X size={18} color={coworkUi.textSecondary} />
          </MeetingSheetButton>
        )}
      </XStack>
    </XStack>
  )
}
