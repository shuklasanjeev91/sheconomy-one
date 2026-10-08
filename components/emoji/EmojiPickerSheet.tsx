import { useEffect, useMemo, useState } from 'react'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { ReactionStickerImage } from '~/components/emoji/ReactionStickerImage'
import { ScreenSearchField } from '~/components/search'
import { Text, XStack, YStack } from '~/components/ui'
import { filterEmojiPalette } from '~/lib/emoji/picker'
import { REACTION_STICKERS, filterReactionStickers } from '~/lib/emoji/reaction-stickers'
import { useAppUi } from '~/lib/theme/useAppUi'

type EmojiPickerSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (emoji: string) => void
  title?: string
}

export function EmojiPickerSheet({
  open,
  onOpenChange,
  onPick,
  title = 'Emoji',
}: EmojiPickerSheetProps) {
  const ui = useAppUi()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const emojis = useMemo(() => filterEmojiPalette(query), [query])
  const stickers = useMemo(() => filterReactionStickers(REACTION_STICKERS, query), [query])
  const hasResults = emojis.length > 0 || stickers.length > 0

  return (
    <CommunityAdaptiveSheet open={open} onOpenChange={onOpenChange} title={title} maxWidth={480}>
      <ScreenSearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search emoji or stickers"
        clearable
      />
      {!hasResults ? (
        <Text fontSize={14} color={ui.textMuted} paddingVertical="$3">
          No emoji or stickers match your search.
        </Text>
      ) : (
        <YStack gap="$3">
          {stickers.length > 0 ? (
            <YStack gap="$2">
              <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
                Stickers
              </Text>
              <XStack flexWrap="wrap" justifyContent="flex-start" rowGap={6} columnGap={4}>
                {stickers.map((sticker) => (
                  <XStack
                    key={sticker.value}
                    onPress={() => {
                      onPick(sticker.value)
                      onOpenChange(false)
                      setQuery('')
                    }}
                    cursor="pointer"
                    width="16.66%"
                    minWidth={54}
                    height={54}
                    alignItems="center"
                    justifyContent="center"
                    borderRadius={12}
                    hoverStyle={{ backgroundColor: ui.surfaceHover, scale: 1.06 }}
                    pressStyle={{ scale: 0.92 }}
                    animation="quick"
                    accessibilityLabel={sticker.label}
                  >
                    <ReactionStickerImage value={sticker.value} sticker={sticker} size={44} />
                  </XStack>
                ))}
              </XStack>
            </YStack>
          ) : null}

          {emojis.length > 0 ? (
            <YStack gap="$2">
              <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
                Emoji
              </Text>
              <XStack flexWrap="wrap" justifyContent="flex-start" rowGap={4} columnGap={2}>
                {emojis.map((emoji, index) => (
                  <XStack
                    key={`${emoji}-${index}`}
                    onPress={() => {
                      onPick(emoji)
                      onOpenChange(false)
                      setQuery('')
                    }}
                    cursor="pointer"
                    width="12.5%"
                    minWidth={44}
                    height={44}
                    alignItems="center"
                    justifyContent="center"
                    borderRadius={10}
                    hoverStyle={{ backgroundColor: ui.surfaceHover, scale: 1.08 }}
                    pressStyle={{ scale: 0.92 }}
                    animation="quick"
                    accessibilityLabel={`Insert ${emoji}`}
                  >
                    <Text fontSize={26}>{emoji}</Text>
                  </XStack>
                ))}
              </XStack>
            </YStack>
          ) : null}
        </YStack>
      )}
    </CommunityAdaptiveSheet>
  )
}
