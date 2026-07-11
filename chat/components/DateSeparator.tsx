import { useChatTheme } from '~/chat/lib/chat-theme'
import { Text, XStack } from '~/components/ui'

export function DateSeparator({ label }: { label: string }) {
  const chat = useChatTheme()
  if (!label) return null

  return (
    <XStack width="100%" justifyContent="center" marginVertical={10}>
      <XStack
        backgroundColor={chat.systemPillBg}
        paddingHorizontal={12}
        paddingVertical={5}
        borderRadius={999}
        shadowColor="#000"
        shadowOpacity={0.05}
        shadowRadius={2}
        shadowOffset={{ width: 0, height: 1 }}
      >
        <Text fontSize={12} fontWeight="600" color={chat.systemPillText}>
          {label}
        </Text>
      </XStack>
    </XStack>
  )
}
