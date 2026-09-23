import { AppBottomSheet, Button, Text, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingEndDialogProps = {
  open: boolean
  isHost: boolean
  onClose: () => void
  onLeave: () => void
  onEndAll: () => void
}

/** Leave / End meeting confirmation as a bottom sheet. */
export function MeetingEndDialog({
  open,
  isHost,
  onClose,
  onLeave,
  onEndAll,
}: MeetingEndDialogProps) {
  const { ui } = useCoWorkTheme()

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={isHost ? 'End meeting or leave?' : 'Leave meeting?'}
      showHandle
      scrollable={false}
      fitContent
      footer={
        <YStack gap="$2.5" width="100%">
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
                End meeting for all
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
                Leave meeting
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
              Leave meeting
            </Button>
          )}
          <Button tone="ghost" borderRadius={10} height={40} onPress={onClose}>
            Cancel
          </Button>
        </YStack>
      }
    >
      <Text fontSize={14} color={ui.textSecondary} lineHeight={20}>
        {isHost
          ? 'You are the host. If you leave without ending, you can assign a new host or end the meeting for all participants.'
          : 'Are you sure you want to leave this meeting? You can rejoin anytime using the meeting ID.'}
      </Text>
    </AppBottomSheet>
  )
}
