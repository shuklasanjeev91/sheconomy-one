import type { ReactNode } from 'react'
import { Platform, type StyleProp, type ViewStyle } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

type MeetingSheetButtonProps = {
  onPress: () => void
  disabled?: boolean
  accessibilityLabel: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/** RN Pressable for meeting sheets — Tamagui Button swallows Android taps in overlays. */
export function MeetingSheetButton({
  onPress,
  disabled,
  accessibilityLabel,
  children,
  style,
}: MeetingSheetButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      collapsable={false}
      style={({ pressed }) => [
        {
          minHeight: 44,
          minWidth: 44,
          justifyContent: 'center',
          alignItems: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  )
}

export const meetingSheetIsNative = Platform.OS !== 'web'
