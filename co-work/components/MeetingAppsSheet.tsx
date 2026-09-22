import { Modal, Pressable } from 'react-native'

import { Icons, Text, XStack, YStack } from '~/components/ui'
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

/**
 * Zoom-style Apps sheet — Polls / Q&A / Whiteboard / Breakouts entry points.
 */
export function MeetingAppsSheet({ open, onClose, actions }: MeetingAppsSheetProps) {
  const { ui } = useCoWorkTheme()
  if (!open) return null

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420 }}>
          <YStack
            backgroundColor="#1A0F16"
            borderRadius={16}
            borderWidth={1}
            borderColor="rgba(255,255,255,0.12)"
            paddingVertical="$3"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}
          >
            <XStack
              alignItems="center"
              justifyContent="space-between"
              paddingHorizontal="$4"
              paddingBottom="$2"
            >
              <Text color="#fff" fontSize={16} fontWeight="800">
                Apps
              </Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close apps">
                <Icons.X size={18} color="#fff" />
              </Pressable>
            </XStack>

            <YStack paddingHorizontal="$2" gap={2}>
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
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: pressed ? 'rgba(216,27,96,0.18)' : 'transparent',
                    })}
                  >
                    <YStack
                      width={40}
                      height={40}
                      borderRadius={12}
                      alignItems="center"
                      justifyContent="center"
                      backgroundColor="rgba(255,255,255,0.08)"
                    >
                      <Icon size={18} color={ui.brandLight} />
                    </YStack>
                    <YStack flex={1} gap={2} minWidth={0}>
                      <Text color="#fff" fontSize={14} fontWeight="700">
                        {action.label}
                      </Text>
                      <Text color="rgba(255,255,255,0.55)" fontSize={12} numberOfLines={1}>
                        {action.hint}
                      </Text>
                    </YStack>
                    <Icons.ChevronRight size={16} color="rgba(255,255,255,0.35)" />
                  </Pressable>
                )
              })}
            </YStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
