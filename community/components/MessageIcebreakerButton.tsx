import { useState } from 'react'
import { useRouter } from 'one'

import { createDirectConversation, sendMessage } from '~/chat/lib/chats'
import { buildIcebreakers } from '~/community/lib/icebreakers'
import {
  AppBottomSheet,
  Button,
  Icons,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { BRAND_BLUE } from '~/community/lib/constants'
import { buildSignInUrl } from '~/lib/auth/redirect'
import { chatRoutes, routes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type MessageIcebreakerButtonProps = {
  targetUserId: string
  targetUsername?: string | null
  displayName: string
  headline?: string | null
  industry?: string | null
  creatorMode?: boolean
  size?: 'sm' | 'md'
}

/** Opens icebreaker starters and starts a direct chat (professional). */
export function MessageIcebreakerButton({
  targetUserId,
  targetUsername,
  displayName,
  headline,
  industry,
  creatorMode,
  size = 'md',
}: MessageIcebreakerButtonProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()
  const [open, setOpen] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  if (user?.id === targetUserId) return null

  const signInRedirect = targetUsername
    ? routes.userProfile(targetUsername)
    : routes.profile

  const icebreakers = buildIcebreakers({
    displayName,
    headline,
    industry,
    creatorMode,
  })

  async function openConversation(options?: { message?: string; id?: string }) {
    if (!user?.id) {
      router.push(buildSignInUrl(signInRedirect) as never)
      return
    }

    setSendingId(options?.id ?? 'open')
    const { conversationId, error: createError } = await createDirectConversation(targetUserId)
    if (createError || !conversationId) {
      setSendingId(null)
      toast.show('Could not start chat', { tone: 'danger', message: createError ?? undefined })
      return
    }

    if (options?.message) {
      const { error: sendError } = await sendMessage({
        conversationId,
        senderId: user.id,
        content: options.message,
        type: 'text',
      })
      if (sendError) {
        setSendingId(null)
        toast.show('Could not send message', { tone: 'danger', message: sendError })
        router.push(chatRoutes.conversation(conversationId) as never)
        return
      }
      toast.show('Message sent', { tone: 'success' })
    }

    setSendingId(null)
    setOpen(false)
    router.push(chatRoutes.conversation(conversationId) as never)
  }

  return (
    <>
      <XStack
        paddingHorizontal={size === 'sm' ? '$2.5' : '$3'}
        paddingVertical={size === 'sm' ? 5 : 6}
        borderRadius={20}
        borderWidth={1}
        borderColor={BRAND_BLUE}
        backgroundColor={BRAND_BLUE}
        alignItems="center"
        justifyContent="center"
        gap="$1.5"
        cursor="pointer"
        hoverStyle={{ opacity: 0.9 }}
        onPress={() => {
          if (!user) {
            router.push(buildSignInUrl(signInRedirect) as never)
            return
          }
          setOpen(true)
        }}
      >
        <Icons.MessageCircle size={size === 'sm' ? 14 : 16} color="white" />
        <Text fontSize={size === 'sm' ? 13 : 14} fontWeight="600" color="white">
          Message
        </Text>
      </XStack>

      <AppBottomSheet open={open} onOpenChange={setOpen} title={`Message ${displayName}`}>
        <YStack gap="$3" padding="$2">
          <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
            Pick a starter, or open chat and write your own.
          </Text>
          {icebreakers.map((item) => (
            <YStack
              key={item.id}
              gap="$2"
              padding="$3"
              borderRadius={12}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
            >
              <Text fontSize={13} fontWeight="700" color={ui.text}>
                {item.label}
              </Text>
              <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
                {item.message}
              </Text>
              <Button
                size="$3"
                tone="primary"
                borderRadius={999}
                alignSelf="flex-start"
                disabled={sendingId != null}
                icon={sendingId === item.id ? <Spinner size="small" color="white" /> : undefined}
                onPress={() => void openConversation({ id: item.id, message: item.message })}
              >
                {sendingId === item.id ? 'Sending…' : 'Send'}
              </Button>
            </YStack>
          ))}
          <Button
            tone="outline"
            size="$3"
            borderRadius={999}
            disabled={sendingId != null}
            onPress={() => void openConversation({ id: 'open' })}
          >
            {sendingId === 'open' ? 'Opening…' : 'Open chat'}
          </Button>
        </YStack>
      </AppBottomSheet>
    </>
  )
}
