import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { AppBottomSheet, Icons, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

export type MeetingAppsSheetAction = {
  key: string
  label: string
  hint: string
  icon: typeof Icons.LayoutGrid
  onPress: () => void
}

type MeetingAppsSheetProps = {
  open: boolean
  onClose: () => void
  actions: MeetingAppsSheetAction[]
}

/** Zoom-style Apps bottom sheet — Polls / Q&A / Whiteboard / Breakouts. */
export function MeetingAppsSheet({ open, onClose, actions }: MeetingAppsSheetProps) {
  const { ui } = useCoWorkTheme()

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Apps"
      showHandle
      scrollable={false}
      fitContent
      surfaceColor={ui.meetingBarElevated}
      handleColor={ui.borderSoft}
    >
      <YStack gap={2} paddingBottom="$2">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Pressable
              key={action.key}
              onPress={() => {
                onClose()
                action.onPress()
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 10,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: pressed ? ui.brandMuted : 'transparent',
              })}
            >
              <YStack
                width={40}
                height={40}
                borderRadius={12}
                alignItems="center"
                justifyContent="center"
                backgroundColor={ui.meetingControl}
              >
                <Icon size={18} color={ui.brand} />
              </YStack>
              <YStack flex={1} gap={3} minWidth={0}>
                <Text color={ui.text} fontSize={15} fontWeight="800">
                  {action.label}
                </Text>
                <Text color={ui.textSecondary} fontSize={12} numberOfLines={2}>
                  {action.hint}
                </Text>
              </YStack>
              <Icons.ChevronRight size={16} color={ui.textMuted} />
            </Pressable>
          )
        })}
      </YStack>
    </AppBottomSheet>
  )
}
