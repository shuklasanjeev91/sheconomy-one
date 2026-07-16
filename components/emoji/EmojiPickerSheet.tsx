import { useEffect, useMemo, useState } from 'react'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { ScreenSearchField } from '~/components/search'
import { Text, XStack, YStack } from '~/components/ui'
import { filterEmojiPalette } from '~/lib/emoji/picker'
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

  return (
    <CommunityAdaptiveSheet open={open} onOpenChange={onOpenChange} title={title} maxWidth={480}>
      <ScreenSearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search emoji"
        clearable
      />
      {emojis.length === 0 ? (
        <Text fontSize={14} color={ui.textMuted} paddingVertical="$3">
          No emoji match your search. Try &quot;heart&quot;, &quot;party&quot;, or &quot;smile&quot;.
        </Text>
      ) : (
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
      )}
    </CommunityAdaptiveSheet>
  )
}
