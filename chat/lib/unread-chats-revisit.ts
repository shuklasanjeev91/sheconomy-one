import type { ChatSummary } from '~/chat/lib/types'
import { chatRoutes } from '~/lib/routes'

export type UnreadChatRevisitCard = {
  chatId: string
  title: string
  preview: string
  unreadCount: number
  avatarUrl: string | null
  href: string
  isGroup: boolean
}

function chatTitle(chat: ChatSummary) {
  if (chat.type === 'direct') {
    return chat.otherUserName ?? chat.name ?? 'Direct message'
  }
  return chat.name || 'Group chat'
}

function chatPreview(chat: ChatSummary) {
  if (chat.lastMessage?.trim()) return chat.lastMessage.trim()
  if (chat.lastMessageType === 'image') return 'Photo'
  if (chat.lastMessageType === 'file') return 'File'
  if (chat.lastMessageType === 'call') return 'Call'
  return 'New message'
}

export function buildUnreadChatRevisitCards(
  chats: ChatSummary[],
  limit = 5,
): UnreadChatRevisitCard[] {
  return chats
    .filter((chat) => !chat.isArchived && chat.unreadCount > 0)
    .sort((a, b) => {
      const aAt = a.lastMessageTime ? Date.parse(a.lastMessageTime) : 0
      const bAt = b.lastMessageTime ? Date.parse(b.lastMessageTime) : 0
      return bAt - aAt
    })
    .slice(0, limit)
    .map((chat) => ({
      chatId: chat.id,
      title: chatTitle(chat),
      preview: chatPreview(chat),
      unreadCount: chat.unreadCount,
      avatarUrl: chat.type === 'direct' ? chat.otherUserAvatar ?? chat.avatarUrl : chat.avatarUrl,
      href: chatRoutes.conversation(chat.id),
      isGroup: chat.type === 'group',
    }))
}
