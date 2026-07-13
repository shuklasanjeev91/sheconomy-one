import { AppBottomSheet, Text, XStack } from '~/components/ui'

import { EMOJI_PALETTE } from '~/chat/lib/emoji'
import { useChatTheme } from '~/chat/lib/chat-theme'

type EmojiPickerSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (emoji: string) => void
}

export function EmojiPickerSheet({ open, onOpenChange, onPick }: EmojiPickerSheetProps) {
  const theme = useChatTheme()

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Emoji" scrollable={false}>
      <XStack flexWrap="wrap" justifyContent="space-between" rowGap={4}>
        {EMOJI_PALETTE.map((emoji, index) => (
          <XStack
            key={`${emoji}-${index}`}
            onPress={() => onPick(emoji)}
            cursor="pointer"
            width="12.5%"
            height={44}
            alignItems="center"
            justifyContent="center"
            borderRadius={10}
            hoverStyle={{ backgroundColor: theme.listItemHover, scale: 1.1 }}
            pressStyle={{ scale: 0.9 }}
            animation="quick"
          >
            <Text fontSize={26}>{emoji}</Text>
          </XStack>
        ))}
      </XStack>
    </AppBottomSheet>
  )
}
