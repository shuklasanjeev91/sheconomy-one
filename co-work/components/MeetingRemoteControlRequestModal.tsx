import { AppBottomSheet, Button, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingRemoteControlRequestModalProps = {
  open: boolean
  requesterName: string
  onAccept: () => void
  onDeny: () => void
}

/** Accept/deny remote control request as a bottom sheet. */
export function MeetingRemoteControlRequestModal({
  open,
  requesterName,
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
      title="Remote control request"
      showHandle
      scrollable={false}
      footer={
        <XStack gap="$2" width="100%">
          <Button tone="outline" flex={1} borderRadius={999} onPress={onDeny}>
            Deny
          </Button>
          <Button tone="primary" flex={1} borderRadius={999} onPress={onAccept}>
            Allow
          </Button>
        </XStack>
      }
    >
      <Text fontSize={14} color={ui.textSecondary} lineHeight={20}>
        {requesterName} wants to control your shared screen. You can revoke access anytime by
        stopping share.
      </Text>
    </AppBottomSheet>
  )
}
