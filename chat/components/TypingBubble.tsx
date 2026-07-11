import { useEffect, useState } from 'react'

import { useChatTheme } from '~/chat/lib/chat-theme'
import { XStack, YStack } from '~/components/ui'

/** Left-aligned "typing…" bubble with cycling dots. */
export function TypingBubble() {
  const chat = useChatTheme()
  const [step, setStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setStep((s) => (s + 1) % 3), 320)
    return () => clearInterval(interval)
  }, [])

  return (
    <XStack width="100%" justifyContent="flex-start" paddingHorizontal="$3" marginTop={6}>
      <XStack
        backgroundColor={chat.bubbleIn}
        paddingHorizontal={14}
        paddingVertical={12}
        borderRadius={14}
        borderTopLeftRadius={3}
        gap={5}
        alignItems="center"
      >
        {[0, 1, 2].map((i) => (
          <YStack
            key={i}
            width={7}
            height={7}
            borderRadius={999}
            backgroundColor={chat.bubbleMetaIn}
            opacity={step === i ? 1 : 0.4}
          />
        ))}
      </XStack>
    </XStack>
  )
}
