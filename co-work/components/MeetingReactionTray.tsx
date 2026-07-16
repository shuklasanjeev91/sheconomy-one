import { Button, Text, XStack, YStack } from '~/components/ui'
import { MEETING_REACTIONS } from '~/co-work/lib/meeting-reactions'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { coworkBoxShadow } from '~/lib/platform/crossStyles'

type MeetingReactionTrayProps = {
  open: boolean
  onSelect: (emoji: string) => void
}

/** Quick-reaction strip above the meeting control dock. */
export function MeetingReactionTray({ open, onSelect }: MeetingReactionTrayProps) {
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()
  if (!open) return null

  return (
    <YStack
      position="absolute"
      bottom="100%"
      left={0}
      right={0}
      alignItems="center"
      marginBottom={10}
      zIndex={5}
      pointerEvents="box-none"
    >
      <XStack
        alignItems="center"
        gap="$1"
        paddingHorizontal="$2.5"
        paddingVertical="$2"
        borderRadius={999}
        borderWidth={1}
        borderColor={coworkUi.glassBorder}
        style={{
          ...coworkGlassStyle(coworkUi, true),
          ...coworkBoxShadow(coworkShadows, 'dock'),
        }}
      >
        {MEETING_REACTIONS.map((item) => (
          <Button
            key={item.emoji}
            aria-label={item.label}
            chromeless
            circular
            width={44}
            height={44}
            padding={0}
            pressStyle={{ scale: 1.15 }}
            hoverStyle={{ scale: 1.08, backgroundColor: 'rgba(255,255,255,0.08)' }}
            onPress={() => onSelect(item.emoji)}
          >
            <Text fontSize={24}>{item.emoji}</Text>
          </Button>
        ))}
      </XStack>
    </YStack>
  )
}
