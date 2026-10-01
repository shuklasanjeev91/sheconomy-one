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
  /** Extra left offset so the card clears overlay controls (e.g. the security shield). */
  leadingInset?: number
}

/**
 * Recording consent notice — sticky while recording continues (Zoom-style).
 * Participants can dismiss the banner or leave the meeting.
 */
export function MeetingRecordingConsentBanner({
  recording,
  isHost,
  onLeave,
  leadingInset = 0,
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
      marginTop="$2"
      marginRight="$3"
      marginLeft={12 + leadingInset}
      paddingHorizontal="$3"
      paddingVertical="$2.5"
      borderRadius={12}
      backgroundColor={coworkUi.surface}
      borderWidth={1}
      borderColor={coworkUi.border}
      borderLeftWidth={3}
      borderLeftColor={coworkUi.danger}
      gap="$2"
      shadowColor="#000"
      shadowOpacity={0.25}
      shadowRadius={8}
      shadowOffset={{ width: 0, height: 2 }}
      elevation={4}
    >
      <XStack alignItems="center" gap="$2.5" flex={1} minWidth={0}>
        <YStack width={8} height={8} borderRadius={4} backgroundColor={coworkUi.danger} flexShrink={0} />
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={13} fontWeight="700" color={coworkUi.text} numberOfLines={1}>
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
            borderColor={coworkUi.danger}
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
          borderColor={coworkUi.border}
          icon={<Icons.X size={14} color={coworkUi.textSecondary} />}
          onPress={() => setDismissed(true)}
          accessibilityLabel="Dismiss recording notice"
        />
      </XStack>
    </XStack>
  )
}
