import { Button, Text, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { pageGradientStyle } from '~/lib/platform/crossStyles'

type MeetingEndedScreenProps = {
  title?: string
  reason?: 'ended' | 'cancelled' | 'removed'
  onDone: () => void
}

/** Shown after the host ends the meeting (or host-leave ends the room). */
export function MeetingEndedScreen({
  title = 'Meeting ended',
  reason = 'ended',
  onDone,
}: MeetingEndedScreenProps) {
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const subtitle =
    reason === 'cancelled'
      ? 'The host cancelled this meeting.'
      : reason === 'removed'
        ? 'You were removed from this meeting.'
        : 'The host ended this meeting for everyone.'

  return (
    <ScreenFill
      style={pageGradientStyle(coworkGradients.page, coworkUi.pageBg)}
      backgroundColor={coworkUi.pageBg}
      alignItems="center"
      justifyContent="center"
      padding="$5"
    >
      <ScreenCenter gap="$4" maxWidth={420} width="100%">
        <YStack
          width={64}
          height={64}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor={coworkUi.dangerMuted}
          borderWidth={1}
          borderColor="rgba(244,63,104,0.35)"
        >
          <Text fontSize={28}>✓</Text>
        </YStack>
        <YStack gap="$2" alignItems="center">
          <Text
            fontSize={24}
            fontWeight="800"
            color={coworkUi.text}
            textAlign="center"
            letterSpacing={-0.4}
          >
            {title}
          </Text>
          <Text fontSize={15} color={coworkUi.textSecondary} textAlign="center" lineHeight={22}>
            {subtitle}
          </Text>
        </YStack>
        <Button tone="primary" size="$4" borderRadius={999} width="100%" onPress={onDone}>
          Back to Co-Work
        </Button>
      </ScreenCenter>
    </ScreenFill>
  )
}
