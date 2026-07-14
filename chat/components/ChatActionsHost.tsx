import { useRouter } from 'one'

import { NewChatSheet } from '~/chat/components/NewChatSheet'
import { closeNewChat, useNewChatOpen } from '~/chat/lib/chat-actions-store'
import { chatRoutes } from '~/lib/routes'
import { useSupabase } from '~/providers/SupabaseProvider'

/**
 * Renders the shared "new chat" picker for the whole chat section so the bottom
 * tab (and any other trigger) can open it from any chat sub-route.
 */
export function ChatActionsHost() {
  const router = useRouter()
  const { user } = useSupabase()
  const open = useNewChatOpen()

  if (!user?.id) return null

  return (
    <NewChatSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) closeNewChat()
      }}
      currentUserId={user.id}
      onConversationReady={(id) => {
        closeNewChat()
        router.push(chatRoutes.conversation(id))
      }}
    />
  )
}
