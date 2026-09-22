import { Modal, Pressable } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingEndDialogProps = {
  open: boolean
  isHost: boolean
  onClose: () => void
  onLeave: () => void
  onEndAll: () => void
}

export function MeetingEndDialog({
  open,
  isHost,
  onClose,
  onLeave,
  onEndAll,
}: MeetingEndDialogProps) {
  const { ui } = useCoWorkTheme()

  if (!open) return null

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}
        onPress={onClose}
      >
        <Pressable
          style={{ width: '100%', maxWidth: 400 }}
          onPress={(e) => e.stopPropagation()}
        >
          <YStack
            backgroundColor={ui.surfaceElevated}
            borderRadius={16}
            borderWidth={1}
            borderColor={ui.borderSoft}
            padding="$5"
            gap="$4"
            style={{
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.5)',
            }}
          >
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.3}>
                {isHost ? 'End Meeting or Leave?' : 'Leave Meeting?'}
              </Text>
              <Button
                tone="ghost"
                size="$2"
                circular
                icon={<Icons.X size={16} color={ui.textSecondary} />}
                onPress={onClose}
                accessibilityLabel="Close"
              />
            </XStack>

            <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
              {isHost
                ? 'You are the host. If you leave without ending, you can assign a new host or end the meeting for all participants.'
                : 'Are you sure you want to leave this meeting? You can rejoin anytime using the meeting ID.'}
            </Text>

            <YStack gap="$2.5" paddingTop="$2">
              {isHost ? (
                <>
                  <Button
                    tone="primary"
                    backgroundColor={ui.danger}
                    borderRadius={10}
                    height={44}
                    onPress={() => {
                      onClose()
                      onEndAll()
                    }}
                  >
                    <Text fontSize={14} fontWeight="700" color="#FFFFFF">
                      End Meeting for All
                    </Text>
                  </Button>
                  <Button
                    tone="outline"
                    borderRadius={10}
                    height={44}
                    onPress={() => {
                      onClose()
                      onLeave()
                    }}
                  >
                    <Text fontSize={14} fontWeight="600" color={ui.text}>
                      Leave Meeting
                    </Text>
                  </Button>
                </>
              ) : (
                <Button
                  tone="primary"
                  backgroundColor={ui.danger}
                  borderRadius={10}
                  height={44}
                  onPress={() => {
                    onClose()
                    onLeave()
                  }}
                >
                  <Text fontSize={14} fontWeight="700" color="#FFFFFF">
                    Leave Meeting
                  </Text>
                </Button>
              )}

              <Button tone="ghost" borderRadius={10} height={40} onPress={onClose}>
                <Text fontSize={13} color={ui.textSecondary}>
                  Cancel
                </Text>
              </Button>
            </YStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
