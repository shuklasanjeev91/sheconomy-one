import { AppBottomSheet, Button, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingRemoteControlRequestModalProps = {
  open: boolean
  requesterName: string
  title?: string
  message?: string
  acceptLabel?: string
  onAccept: () => void
  onDeny: () => void
}

/** Accept/deny a participant request (remote control, recording) as a bottom sheet. */
export function MeetingRemoteControlRequestModal({
  open,
  requesterName,
  title = 'Remote control request',
  message,
  acceptLabel = 'Allow',
  onAccept,
  onDeny,
}: MeetingRemoteControlRequestModalProps) {
  const { ui } = useCoWorkTheme()

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onDeny()
      }}
      title={title}
      showHandle
      scrollable={false}
      footer={
        <XStack gap="$2" width="100%">
          <Button tone="outline" flex={1} borderRadius={999} onPress={onDeny}>
            Deny
          </Button>
          <Button tone="primary" flex={1} borderRadius={999} onPress={onAccept}>
            {acceptLabel}
          </Button>
        </XStack>
      }
    >
      <Text fontSize={14} color={ui.textSecondary} lineHeight={20}>
        {message ??
          `${requesterName} wants to control your shared screen. You can revoke access anytime by stopping share.`}
      </Text>
    </AppBottomSheet>
  )
}
