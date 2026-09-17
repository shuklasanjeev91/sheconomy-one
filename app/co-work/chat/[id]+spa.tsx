import { useLocalSearchParams } from 'one'

import { CoWorkMainChatScreen } from '~/co-work/screens/CoWorkMainChatScreen'

export default function CoWorkMainChatThreadRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const raw = params.id
  const chatId = Array.isArray(raw) ? raw[0] : raw
  return <CoWorkMainChatScreen chatId={chatId ?? null} />
}
