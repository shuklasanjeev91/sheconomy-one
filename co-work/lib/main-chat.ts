/**
 * Co-Work Main Chat helpers.
 *
 * Surface A — Co-Work Main Chat: persistent collaboration via conversations/messages
 *   with conversation_type = 'cowork'.
 * Surface B — Meeting Chat: scoped to one meeting via meeting_chat_messages.
 *
 * Do not read or write meeting_chat_messages from this module.
 */

import { supabase } from '~/lib/supabase/client'
import type { ChatSummary } from '~/chat/lib/types'

export const COWORK_MAIN_CHAT_SURFACE = 'cowork_main_chat' as const
export const MEETING_CHAT_SURFACE = 'meeting_chat' as const

export type CollaborationChatSurface =
  | typeof COWORK_MAIN_CHAT_SURFACE
  | typeof MEETING_CHAT_SURFACE

export function collaborationChatSurfaceLabel(surface: CollaborationChatSurface): string {
  if (surface === COWORK_MAIN_CHAT_SURFACE) return 'Co-Work Main Chat'
  return 'Meeting Chat'
}

export function collaborationChatSurfaceDescription(surface: CollaborationChatSurface): string {
  if (surface === COWORK_MAIN_CHAT_SURFACE) {
    return 'Persistent collaboration outside meetings. Not tied to a live room.'
  }
  return 'Belongs only to this meeting and ends with the meeting lifecycle.'
}

export function isCoworkMainChatConversationType(value: string | null | undefined): boolean {
  return value === 'cowork'
}

type CoworkChatRow = {
  chat_id: string
  chat_name: string | null
  chat_type: string | null
  last_message: string | null
  last_message_time: string | null
  unread_count: number | string | null
  avatar_url: string | null
  other_user_id: string | null
  other_user_name: string | null
  other_user_avatar: string | null
  is_online: boolean | null
  last_seen: string | null
  current_user_role: string | null
  last_message_sender_name: string | null
  is_pinned: boolean | null
  is_muted: boolean | null
  is_archived: boolean | null
  last_message_type: string | null
}

function mapCoworkChatSummary(row: CoworkChatRow): ChatSummary {
  return {
    id: row.chat_id,
    name: row.chat_name ?? 'Co-Work chat',
    type: row.chat_type === 'group' ? 'group' : 'direct',
    lastMessage: row.last_message ?? '',
    lastMessageType: row.last_message_type ?? 'text',
    lastMessageTime: row.last_message_time,
    lastMessageSenderName: row.last_message_sender_name,
    unreadCount: Number(row.unread_count ?? 0),
    avatarUrl: row.avatar_url || null,
    otherUserId: row.other_user_id,
    otherUserName: row.other_user_name,
    otherUserAvatar: row.other_user_avatar || null,
    isOnline: !!row.is_online,
    lastSeen: row.last_seen,
    currentUserRole: row.current_user_role ?? 'member',
    isPinned: !!row.is_pinned,
    isMuted: !!row.is_muted,
    isArchived: !!row.is_archived,
  }
}

/** List persistent Co-Work Main Chat threads only (never meeting chat). */
export async function fetchCoworkMainChats(
  userId: string,
): Promise<{ items: ChatSummary[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_cowork_user_chats', { p_user_id: userId })
  if (error) return { items: [], error: error.message }
  return { items: ((data ?? []) as CoworkChatRow[]).map(mapCoworkChatSummary), error: null }
}

export async function createCoworkDirectConversation(
  otherUserId: string,
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_cowork_direct_conversation', {
    p_other_user_id: otherUserId,
  })
  if (error) return { conversationId: null, error: error.message }
  return { conversationId: (data as string) ?? null, error: null }
}

export async function createCoworkGroupConversation(
  participantIds: string[],
  title: string | null,
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_cowork_group_conversation', {
    p_participant_ids: participantIds,
    p_title: title ?? undefined,
  })
  if (error) return { conversationId: null, error: error.message }
  return { conversationId: (data as string) ?? null, error: null }
}

export function coworkMainChatUnreadTotal(chats: Pick<ChatSummary, 'unreadCount'>[]): number {
  return chats.reduce((sum, chat) => sum + (chat.unreadCount > 0 ? chat.unreadCount : 0), 0)
}
