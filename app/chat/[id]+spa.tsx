import { useParams } from 'one'

import { ChatScreen } from '~/chat/screens/ChatScreen'

export default function ChatConversationRoute() {
  const { id } = useParams<{ id: string }>()
  return <ChatScreen chatId={id ?? null} />
}