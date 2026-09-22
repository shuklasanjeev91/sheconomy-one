import { useEffect, useState } from 'react'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingRecordingConsentBannerProps = {
  /** Whether a cloud recording is actively in progress. */
  recording: boolean
  /** True if the current user is the host — hosts don't need the notice. */
  isHost: boolean
  /** Leave the meeting if the participant declines consent. */
  onLeave?: () => void
}

/**
 * Recording consent notice — sticky while recording continues (Zoom-style).
 * Participants can dismiss the banner or leave the meeting.
 */
export function MeetingRecordingConsentBanner({
  recording,
  isHost,
  onLeave,
}: MeetingRecordingConsentBannerProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [dismissed, setDismissed] = useState(false)
  const [wasRecording, setWasRecording] = useState(false)

  useEffect(() => {
    if (recording && !wasRecording) {
      setDismissed(false)
    }
    setWasRecording(recording)
  }, [recording, wasRecording])

  if (!recording || isHost || dismissed) return null

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$3"
      paddingVertical="$2.5"
      backgroundColor="rgba(224, 40, 40, 0.12)"
      borderBottomWidth={1}
      borderBottomColor="rgba(224, 40, 40, 0.28)"
      gap="$2"
    >
      <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
        <XStack
          width={28}
          height={28}
          borderRadius={999}
          backgroundColor="rgba(224, 40, 40, 0.2)"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <YStack width={8} height={8} borderRadius={4} backgroundColor={coworkUi.danger} />
        </XStack>
        <YStack flex={1} minWidth={0} gap={1}>
          <Text fontSize={13} fontWeight="700" color={coworkUi.danger}>
            This meeting is being recorded
          </Text>
          <Text fontSize={11} color={coworkUi.textSecondary} numberOfLines={2}>
            By continuing, you consent to being recorded.
          </Text>
        </YStack>
      </XStack>

      <XStack alignItems="center" gap="$2" flexShrink={0}>
        {onLeave ? (
          <Button
            tone="outline"
            size="$2"
            borderRadius={999}
            borderColor="rgba(224, 40, 40, 0.45)"
            color={coworkUi.danger}
            onPress={onLeave}
          >
            Leave
          </Button>
        ) : null}
        <Button
          tone="outline"
          size="$2"
          borderRadius={999}
          icon={<Icons.X size={14} color={coworkUi.textMuted} />}
          onPress={() => setDismissed(true)}
          accessibilityLabel="Dismiss recording notice"
        />
      </XStack>
    </XStack>
  )
}
