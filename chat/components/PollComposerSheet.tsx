import { useState } from 'react'

import { useChatTheme } from '~/chat/lib/chat-theme'
import type { ChatPollPayload } from '~/chat/lib/types'
import { AppBottomSheet, Icons, Input, Text, XStack, YStack } from '~/components/ui'

type PollComposerSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (poll: ChatPollPayload) => void
}

const MAX_OPTIONS = 4

/** Bottom sheet to compose a chat poll (question + 2–4 options). */
export function PollComposerSheet({ open, onOpenChange, onSubmit }: PollComposerSheetProps) {
  const chat = useChatTheme()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])

  function reset() {
    setQuestion('')
    setOptions(['', ''])
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((option, i) => (i === index ? value : option)))
  }

  function addOption() {
    setOptions((prev) => (prev.length >= MAX_OPTIONS ? prev : [...prev, '']))
  }

  function removeOption(index: number) {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)))
  }

  const trimmedQuestion = question.trim()
  const filledOptions = options.map((option) => option.trim()).filter(Boolean)
  const canCreate = trimmedQuestion.length > 0 && filledOptions.length >= 2

  function create() {
    if (!canCreate) return
    onSubmit({ question: trimmedQuestion, options: filledOptions.slice(0, MAX_OPTIONS) })
    reset()
    onOpenChange(false)
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
      title="Create poll"
      scrollable={false}
    >
      <YStack gap={12} paddingBottom={8}>
        <YStack gap={6}>
          <Text fontSize={13} fontWeight="600" color={chat.textSecondary}>
            Question
          </Text>
          <Input
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask something…"
            placeholderTextColor={chat.textMuted}
            color={chat.text}
            backgroundColor={chat.inputBg}
            borderColor={chat.border}
          />
        </YStack>

        <YStack gap={8}>
          <Text fontSize={13} fontWeight="600" color={chat.textSecondary}>
            Options
          </Text>
          {options.map((option, index) => (
            <XStack key={index} gap={8} alignItems="center">
              <Input
                flex={1}
                value={option}
                onChangeText={(value) => updateOption(index, value)}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor={chat.textMuted}
                color={chat.text}
                backgroundColor={chat.inputBg}
                borderColor={chat.border}
                maxLength={80}
              />
              {options.length > 2 ? (
                <XStack
                  onPress={() => removeOption(index)}
                  cursor="pointer"
                  width={32}
                  height={32}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  pressStyle={{ scale: 0.9 }}
                >
                  <Icons.X size={18} color={chat.textMuted} />
                </XStack>
              ) : null}
            </XStack>
          ))}
          {options.length < MAX_OPTIONS ? (
            <XStack
              gap={6}
              alignItems="center"
              alignSelf="flex-start"
              cursor="pointer"
              onPress={addOption}
              paddingVertical={4}
            >
              <Icons.Plus size={18} color={chat.brand} />
              <Text fontSize={14} fontWeight="600" color={chat.brand}>
                Add option
              </Text>
            </XStack>
          ) : null}
        </YStack>

        <XStack
          onPress={canCreate ? create : undefined}
          cursor={canCreate ? 'pointer' : 'default'}
          alignItems="center"
          justifyContent="center"
          height={46}
          borderRadius={999}
          backgroundColor={canCreate ? chat.brand : chat.border}
          pressStyle={canCreate ? { scale: 0.98 } : undefined}
          animation="quick"
        >
          <Text fontSize={15} fontWeight="700" color={canCreate ? chat.brandContrast : chat.textMuted}>
            Send poll
          </Text>
        </XStack>
      </YStack>
    </AppBottomSheet>
  )
}
