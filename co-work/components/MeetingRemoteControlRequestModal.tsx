import { Button, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingRemoteControlRequestModalProps = {
  open: boolean
  requesterName: string
  onAccept: () => void
  onDeny: () => void
}

/** Zoom-style accept/deny dialog when someone requests control of your screen. */
export function MeetingRemoteControlRequestModal({
  open,
  requesterName,
  onAccept,
  onDeny,
}: MeetingRemoteControlRequestModalProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  if (!open) return null

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      alignItems="center"
      justifyContent="center"
      backgroundColor="rgba(12,8,10,0.55)"
      zIndex={250_000}
      padding="$4"
    >
      <YStack
        width="100%"
        maxWidth={360}
        borderRadius={16}
        borderWidth={1}
        borderColor={coworkUi.borderSoft}
        backgroundColor={coworkUi.surface}
        padding="$4"
        gap="$3"
      >
        <Text fontSize={17} fontWeight="800" color={coworkUi.text}>
          Remote control request
        </Text>
        <Text fontSize={14} color={coworkUi.textSecondary} lineHeight={20}>
          {requesterName} wants to control your shared screen. You can revoke access anytime by
          stopping share.
        </Text>
        <XStack gap="$2" justifyContent="flex-end">
          <Button tone="outline" borderRadius={999} onPress={onDeny}>
            Deny
          </Button>
          <Button tone="primary" borderRadius={999} onPress={onAccept}>
            Allow
          </Button>
        </XStack>
      </YStack>
    </YStack>
  )
}
