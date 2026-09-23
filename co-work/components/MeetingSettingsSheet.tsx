import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { AppBottomSheet, Icons, Text, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

export type MeetingSettingsSheetAction = {
  key: string
  label: string
  icon: typeof Icons.Settings
  onPress: () => void
  /** Greyed / not yet available */
  disabled?: boolean
}

type MeetingSettingsSheetProps = {
  open: boolean
  onClose: () => void
  actions: MeetingSettingsSheetAction[]
}

/**
 * Zoom mobile Settings sheet — Meeting settings, Virtual background, Audio, Captions…
 */
export function MeetingSettingsSheet({ open, onClose, actions }: MeetingSettingsSheetProps) {
  const { ui } = useCoWorkTheme()

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Settings"
      showHandle
      scrollable={false}
      fitContent
      surfaceColor={ui.meetingBarElevated}
      handleColor={ui.borderSoft}
    >
      <YStack
        borderRadius={14}
        overflow="hidden"
        borderWidth={1}
        borderColor={ui.borderSoft}
        backgroundColor={ui.meetingControl}
        marginBottom="$2"
      >
        {actions.map((action, index) => {
          const Icon = action.icon
          return (
            <Pressable
              key={action.key}
              disabled={action.disabled}
              onPress={() => {
                if (action.disabled) return
                onClose()
                action.onPress()
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                opacity: action.disabled ? 0.45 : pressed ? 0.75 : 1,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: ui.borderSoft,
              })}
            >
              <Icon size={22} color={ui.text} strokeWidth={1.8} />
              <Text flex={1} color={ui.text} fontSize={16} fontWeight="600">
                {action.label}
              </Text>
              <Icons.ChevronRight size={18} color={ui.textMuted} />
            </Pressable>
          )
        })}
      </YStack>
    </AppBottomSheet>
  )
}
