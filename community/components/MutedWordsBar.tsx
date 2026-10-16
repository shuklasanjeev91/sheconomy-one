import { useState } from 'react'

import { addMutedWord, removeMutedWord, useMutedWords } from '~/community/lib/muted-words'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Input, Text, XStack, YStack } from '~/components/ui'

/** Hide community posts that contain a whole word the reader muted. */
type MutedWordsBarProps = {
  hiddenCount?: number
}

export function MutedWordsBar({ hiddenCount = 0 }: MutedWordsBarProps) {
  const communityUi = useCommunityUi()
  const words = useMutedWords()
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)

  return (
    <YStack gap="$2" paddingHorizontal="$3" paddingBottom="$2">
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={13} fontWeight="700" color={communityUi.text}>
          {words.length > 0 ? `Muted words (${words.length})` : 'Mute words'}
          {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''}
        </Text>
        <Button tone="outline" size="$2" borderRadius={999} onPress={() => setOpen((value) => !value)}>
          {open ? 'Done' : 'Edit'}
        </Button>
      </XStack>
      {open ? (
        <YStack gap="$2">
          <Text fontSize={12} color={communityUi.textMuted} lineHeight={17}>
            Posts containing these words stay out of your feed on this device.
          </Text>
          <XStack gap="$2" alignItems="center">
            <Input
              flex={1}
              value={draft}
              onChangeText={setDraft}
              placeholder="word or hashtag"
              accessibilityLabel="Word to mute"
              onSubmitEditing={() => {
                addMutedWord(draft)
                setDraft('')
              }}
            />
            <Button
              tone="primary"
              size="$3"
              borderRadius={999}
              onPress={() => {
                addMutedWord(draft)
                setDraft('')
              }}
            >
              Mute
            </Button>
          </XStack>
          {words.length > 0 ? (
            <XStack flexWrap="wrap" gap="$2">
              {words.map((word) => (
                <XStack
                  key={word}
                  paddingHorizontal={10}
                  paddingVertical={6}
                  borderRadius={999}
                  backgroundColor={communityUi.accentMuted}
                  cursor="pointer"
                  onPress={() => removeMutedWord(word)}
                >
                  <Text fontSize={12} fontWeight="700" color={communityUi.brand}>
                    {word} ×
                  </Text>
                </XStack>
              ))}
            </XStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  )
}
