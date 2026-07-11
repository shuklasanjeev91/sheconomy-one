import { supabase } from '~/lib/supabase/client'

import type {
  ChatEventPayload,
  ChatMessage,
  ChatMessageType,
  ChatPollPayload,
  ChatSummary,
  ChatType,
  MessageReaction,
  ReplyPreview,
  MessageDeliveryStatus,
} from './types'

export const CHAT_FILES_BUCKET = 'chat-files'
export const MESSAGES_PAGE_SIZE = 30

const MESSAGE_SELECT =
  'id, conversation_id, sender_id, content, message_type, media_url, media_type, file_name, file_size, status, created_at, reply_to_id, deleted_at, edited_at, metadata'

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toChatType(value: unknown): ChatType {
  return value === 'group' ? 'group' : 'direct'
}

function toMessageType(value: unknown): ChatMessageType {
  if (
    value === 'image' ||
    value === 'file' ||
    value === 'call' ||
    value === 'system' ||
    value === 'poll' ||
    value === 'event'
  ) {
    return value
  }
  return 'text'
}

/**
 * Aggregate legacy inline votes (`metadata.votes`) into per-option counts. The
 * old app stored a `{ userId: optionIndex | optionText }` map; we tolerate both.
 */
function legacyVoteCounts(votes: unknown, options: string[]): number[] | undefined {
  if (!votes || typeof votes !== 'object') return undefined
  const counts = new Array(options.length).fill(0) as number[]
  let any = false
  for (const value of Object.values(votes as Record<string, unknown>)) {
    let index = -1
    if (typeof value === 'number') index = value
    else if (typeof value === 'string') {
      const asNumber = Number(value)
      index = Number.isInteger(asNumber) ? asNumber : options.indexOf(value)
    }
    if (index >= 0 && index < options.length) {
      counts[index] += 1
      any = true
    }
  }
  return any ? counts : undefined
}

function parsePollPayload(metadata: unknown): ChatPollPayload | null {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = metadata as Record<string, unknown>
  const question = typeof raw.question === 'string' ? raw.question : null
  const options = Array.isArray(raw.options)
    ? raw.options.filter((option): option is string => typeof option === 'string')
    : null
  if (!question || !options || options.length < 2) return null
  return { question, options, baseCounts: legacyVoteCounts(raw.votes, options) }
}

function parseEventPayload(metadata: unknown): ChatEventPayload | null {
  if (!metadata || typeof metadata !== 'object') return null
  const raw = metadata as Record<string, unknown>
  const eventId = typeof raw.eventId === 'string' ? raw.eventId : null
  // Legacy events store `date` instead of `startTime` and have no backing row.
  const startTime =
    typeof raw.startTime === 'string'
      ? raw.startTime
      : typeof raw.date === 'string'
        ? raw.date
        : null
  return {
    eventId: eventId ?? '',
    title: typeof raw.title === 'string' ? raw.title : '',
    startTime,
    location: typeof raw.location === 'string' ? raw.location : null,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : null,
    isStatic: !eventId,
  }
}

/**
 * The legacy mobile app stored rich messages (photos, documents, polls, events,
 * deletions) as `message_type='text'` with the payload in `metadata` and a
 * bracketed content label. Detect those and surface the correct client type so
 * they render with the modern bubbles instead of raw "[Poll] …" text.
 */
type LegacyOverrides = {
  type: ChatMessageType
  content: string
  mediaUrl: string | null
  mediaType: string | null
  fileName: string | null
  deletedAt: string | null
  poll: ChatPollPayload | null
  event: ChatEventPayload | null
} | null

function resolveLegacyMessage(row: MessageRow): LegacyOverrides {
  const metadata = row.metadata
  if (!metadata || typeof metadata !== 'object') return null
  const raw = metadata as Record<string, unknown>
  const content = row.content ?? ''

  if (raw.is_deleted === true) {
    return {
      type: 'text',
      content: '',
      mediaUrl: null,
      mediaType: null,
      fileName: null,
      deletedAt: row.deleted_at ?? row.created_at ?? new Date().toISOString(),
      poll: null,
      event: null,
    }
  }

  if (raw.type === 'poll' || content.startsWith('[Poll]')) {
    const poll = parsePollPayload(metadata)
    if (poll) {
      return {
        type: 'poll',
        content,
        mediaUrl: null,
        mediaType: null,
        fileName: null,
        deletedAt: null,
        poll,
        event: null,
      }
    }
  }

  if (raw.type === 'event' || content.startsWith('[Event]')) {
    const event = parseEventPayload(metadata)
    if (event && event.title) {
      return {
        type: 'event',
        content,
        mediaUrl: null,
        mediaType: null,
        fileName: null,
        deletedAt: null,
        poll: null,
        event,
      }
    }
  }

  const publicUrl = typeof raw.public_url === 'string' ? raw.public_url : null

  if (content.startsWith('[Photo]') || (publicUrl && /\.(png|jpe?g|gif|webp|heic)$/i.test(publicUrl))) {
    if (publicUrl) {
      return {
        type: 'image',
        content: '',
        mediaUrl: publicUrl,
        mediaType: 'image',
        fileName: typeof raw.name === 'string' ? raw.name : null,
        deletedAt: null,
        poll: null,
        event: null,
      }
    }
  }

  if (content.startsWith('[Document]') || typeof raw.name === 'string') {
    const fileName =
      typeof raw.name === 'string' ? raw.name : content.replace(/^\[Document\]\s*/, '') || 'File'
    const mime = typeof raw.type === 'string' ? raw.type : null
    return {
      type: 'file',
      content: fileName,
      mediaUrl: publicUrl,
      mediaType: mime ? mediaCategory(mime) : 'document',
      fileName,
      deletedAt: null,
      poll: null,
      event: null,
    }
  }

  return null
}

export type MediaCategory = 'image' | 'video' | 'audio' | 'document'

/** Map a MIME type to the coarse `media_type` category the DB enforces. */
export function mediaCategory(mime: string | null | undefined): MediaCategory {
  const value = (mime ?? '').toLowerCase()
  if (value.startsWith('image/')) return 'image'
  if (value.startsWith('video/')) return 'video'
  if (value.startsWith('audio/')) return 'audio'
  return 'document'
}

function toDeliveryStatus(value: unknown): MessageDeliveryStatus {
  if (value === 'delivered' || value === 'read' || value === 'sent' || value === 'failed') {
    return value
  }
  return 'sent'
}

type UserChatRow = {
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

function mapChatSummary(row: UserChatRow): ChatSummary {
  return {
    id: row.chat_id,
    name: row.chat_name ?? 'Chat',
    type: toChatType(row.chat_type),
    lastMessage: row.last_message ?? '',
    lastMessageType: row.last_message_type ?? 'text',
    lastMessageTime: row.last_message_time,
    lastMessageSenderName: row.last_message_sender_name ?? null,
    unreadCount: Number(row.unread_count ?? 0) || 0,
    avatarUrl: row.avatar_url || null,
    otherUserId: row.other_user_id,
    otherUserName: row.other_user_name ?? null,
    otherUserAvatar: row.other_user_avatar || null,
    isOnline: !!row.is_online,
    lastSeen: row.last_seen,
    currentUserRole: row.current_user_role ?? 'member',
    isPinned: !!row.is_pinned,
    isMuted: !!row.is_muted,
    isArchived: !!row.is_archived,
  }
}

type MessageRow = {
  id: string
  conversation_id: string | null
  sender_id: string | null
  content: string | null
  message_type: string | null
  media_url: string | null
  media_type: string | null
  file_name: string | null
  file_size: number | null
  status: string | null
  created_at: string | null
  reply_to_id: string | null
  deleted_at: string | null
  edited_at: string | null
  metadata: unknown
}

export function mapMessage(row: MessageRow): ChatMessage {
  const type = toMessageType(row.message_type)
  // Rich messages from the legacy mobile app were stored as `text` with the
  // payload in `metadata`; upgrade those to their real type on read.
  const legacy = type === 'text' ? resolveLegacyMessage(row) : null

  if (legacy) {
    return {
      id: row.id,
      conversationId: row.conversation_id ?? '',
      senderId: row.sender_id,
      content: legacy.content,
      type: legacy.type,
      mediaUrl: legacy.mediaUrl,
      mediaType: legacy.mediaType,
      fileName: legacy.fileName,
      fileSize: row.file_size,
      status: toDeliveryStatus(row.status),
      createdAt: row.created_at ?? new Date().toISOString(),
      replyToId: row.reply_to_id,
      replyPreview: null,
      deletedAt: legacy.deletedAt,
      editedAt: row.edited_at,
      poll: legacy.poll,
      event: legacy.event,
    }
  }

  return {
    id: row.id,
    conversationId: row.conversation_id ?? '',
    senderId: row.sender_id,
    content: row.content ?? '',
    type,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    fileName: row.file_name,
    fileSize: row.file_size,
    status: toDeliveryStatus(row.status),
    createdAt: row.created_at ?? new Date().toISOString(),
    replyToId: row.reply_to_id,
    replyPreview: null,
    deletedAt: row.deleted_at,
    editedAt: row.edited_at,
    poll: type === 'poll' ? parsePollPayload(row.metadata) : null,
    event: type === 'event' ? parseEventPayload(row.metadata) : null,
  }
}

/** Build a quoted-reply snapshot from a message row (handles tombstones). */
function toReplyPreview(row: MessageRow): ReplyPreview {
  if (row.deleted_at) {
    return { id: row.id, senderId: row.sender_id, content: '', type: 'text', mediaUrl: null }
  }
  return {
    id: row.id,
    senderId: row.sender_id,
    content: row.content ?? '',
    type: toMessageType(row.message_type),
    mediaUrl: row.media_url,
  }
}

/**
 * Resolve `replyPreview` for any message that quotes another. Targets already
 * present in `items` are used directly; the rest are fetched in one round-trip.
 */
export async function resolveReplyPreviews(items: ChatMessage[]): Promise<ChatMessage[]> {
  const targetIds = Array.from(
    new Set(items.filter((m) => m.replyToId).map((m) => m.replyToId as string)),
  )
  if (targetIds.length === 0) return items

  const previews = new Map<string, ReplyPreview>()
  for (const m of items) {
    if (targetIds.includes(m.id)) {
      previews.set(m.id, {
        id: m.id,
        senderId: m.senderId,
        content: m.deletedAt ? '' : m.content,
        type: m.type,
        mediaUrl: m.deletedAt ? null : m.mediaUrl,
      })
    }
  }

  const missing = targetIds.filter((id) => !previews.has(id))
  if (missing.length > 0) {
    const { data } = await supabase.from('messages').select(MESSAGE_SELECT).in('id', missing)
    for (const row of (data ?? []) as MessageRow[]) {
      previews.set(row.id, toReplyPreview(row))
    }
  }

  return items.map((m) =>
    m.replyToId ? { ...m, replyPreview: previews.get(m.replyToId) ?? null } : m,
  )
}

/** Resolve a single reply target (used for realtime inserts). */
export async function fetchReplyPreview(messageId: string): Promise<ReplyPreview | null> {
  const { data } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('id', messageId)
    .maybeSingle()
  return data ? toReplyPreview(data as MessageRow) : null
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function fetchUserChats(
  userId: string,
): Promise<{ items: ChatSummary[]; error: string | null }> {
  const { data, error } = await supabase.rpc('get_user_chats', { p_user_id: userId })
  if (error) return { items: [], error: error.message }
  return { items: ((data ?? []) as UserChatRow[]).map(mapChatSummary), error: null }
}

export async function createDirectConversation(
  otherUserId: string,
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_direct_conversation', {
    p_other_user_id: otherUserId,
  })
  if (error) return { conversationId: null, error: error.message }
  return { conversationId: (data as string) ?? null, error: null }
}

export async function createGroupConversation(
  participantIds: string[],
  title: string | null,
): Promise<{ conversationId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_group_conversation', {
    p_participant_ids: participantIds,
    p_title: title ?? undefined,
  })
  if (error) return { conversationId: null, error: error.message }
  return { conversationId: (data as string) ?? null, error: null }
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function fetchMessages(
  conversationId: string,
  options: { limit?: number; before?: string | null } = {},
): Promise<{ items: ChatMessage[]; hasMore: boolean; error: string | null }> {
  const limit = options.limit ?? MESSAGES_PAGE_SIZE

  let query = supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (options.before) {
    query = query.lt('created_at', options.before)
  }

  const { data, error } = await query
  if (error) return { items: [], hasMore: false, error: error.message }

  const rows = (data ?? []) as MessageRow[]
  const hasMore = rows.length > limit
  const trimmed = hasMore ? rows.slice(0, limit) : rows
  // Fetched newest-first; the thread renders oldest-first.
  const items = await resolveReplyPreviews(trimmed.map(mapMessage).reverse())
  return { items, hasMore, error: null }
}

export type SendMessageInput = {
  conversationId: string
  senderId: string
  content: string
  type?: ChatMessageType
  mediaPath?: string | null
  mediaType?: string | null
  fileName?: string | null
  fileSize?: number | null
  replyToId?: string | null
  metadata?: Record<string, unknown> | null
}

export async function sendMessage(
  input: SendMessageInput,
): Promise<{ messageId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('send_message_with_status', {
    p_chat_room_id: input.conversationId,
    p_sender_id: input.senderId,
    p_content: input.content,
    p_message_type: input.type ?? 'text',
    p_file_url: input.mediaPath ?? undefined,
    p_file_name: input.fileName ?? undefined,
    p_file_size: input.fileSize ?? undefined,
    p_file_type: input.mediaType ?? undefined,
    p_reply_to_id: input.replyToId ?? undefined,
    p_metadata: (input.metadata ?? undefined) as never,
  })
  if (error) return { messageId: null, error: error.message }
  return { messageId: (data as string) ?? null, error: null }
}

/** Send a poll message; the question/options live in `messages.metadata`. */
export async function sendPollMessage(
  conversationId: string,
  senderId: string,
  poll: ChatPollPayload,
): Promise<{ messageId: string | null; error: string | null }> {
  return sendMessage({
    conversationId,
    senderId,
    content: poll.question,
    type: 'poll',
    metadata: { question: poll.question, options: poll.options },
  })
}

/** Send an event card message referencing a community event. */
export async function sendEventMessage(
  conversationId: string,
  senderId: string,
  event: ChatEventPayload,
): Promise<{ messageId: string | null; error: string | null }> {
  return sendMessage({
    conversationId,
    senderId,
    content: event.title,
    type: 'event',
    metadata: {
      eventId: event.eventId,
      title: event.title,
      startTime: event.startTime,
      location: event.location,
      imageUrl: event.imageUrl,
    },
  })
}

/** Edit the text of a message (sender only, enforced by RLS). */
export async function editMessage(
  messageId: string,
  content: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('messages')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', messageId)
  return { error: error?.message ?? null }
}

/** Delete a message for everyone — leaves a tombstone (sender only, RLS). */
export async function deleteMessageForEveryone(
  messageId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString(), content: '', media_url: null })
    .eq('id', messageId)
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

type ReactionRow = { message_id: string; user_id: string; emoji: string }

export async function fetchReactionsForMessages(
  messageIds: string[],
): Promise<MessageReaction[]> {
  if (messageIds.length === 0) return []
  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, emoji')
    .in('message_id', messageIds)
  if (error || !data) return []
  return (data as ReactionRow[]).map((r) => ({
    messageId: r.message_id,
    userId: r.user_id,
    emoji: r.emoji,
  }))
}

/**
 * One reaction per user per message. Tapping the same emoji
 * removes it; a different emoji replaces the existing one.
 */
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<{ error: string | null }> {
  const { data: mine } = await supabase
    .from('message_reactions')
    .select('emoji')
    .eq('message_id', messageId)
    .eq('user_id', userId)

  const existing = (mine ?? []) as { emoji: string }[]
  const hadSame = existing.some((r) => r.emoji === emoji)

  if (existing.length > 0) {
    await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
  }

  if (hadSame) return { error: null }

  const { error } = await supabase
    .from('message_reactions')
    .insert({ message_id: messageId, user_id: userId, emoji })
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Conversation preferences (pin / mute / clear)
// ---------------------------------------------------------------------------

export async function setConversationPinned(
  conversationId: string,
  userId: string,
  pinned: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ is_pinned: pinned })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function setConversationMuted(
  conversationId: string,
  userId: string,
  muted: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ is_muted: muted })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}

/** Archive/unarchive a conversation for the current user only. */
export async function setConversationArchived(
  conversationId: string,
  userId: string,
  archived: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ is_archived: archived })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}

/** Read the disappearing-messages TTL (seconds) for a conversation; null = off. */
export async function fetchDisappearingSeconds(conversationId: string): Promise<number | null> {
  const { data } = await supabase
    .from('conversations')
    .select('disappearing_seconds')
    .eq('id', conversationId)
    .maybeSingle()
  return (data?.disappearing_seconds as number | null) ?? null
}

/** Set (or clear, with null) the disappearing-messages TTL for a conversation. */
export async function setDisappearingSeconds(
  conversationId: string,
  seconds: number | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('conversations')
    .update({ disappearing_seconds: seconds })
    .eq('id', conversationId)
  return { error: error?.message ?? null }
}

/** Clear the thread for the current user only (hides messages up to now). */
export async function clearConversation(
  conversationId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ cleared_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('mark_messages_as_read', {
    p_chat_room_id: conversationId,
    p_user_id: userId,
  })
  return { error: error?.message ?? null }
}

export async function setTypingIndicator(
  conversationId: string,
  userId: string,
  isTyping: boolean,
): Promise<void> {
  await supabase.rpc('set_typing_indicator', {
    p_chat_room_id: conversationId,
    p_user_id: userId,
    p_is_typing: isTyping,
  })
}

// ---------------------------------------------------------------------------
// Media (private `chat-files` bucket, served via signed URLs)
// ---------------------------------------------------------------------------

function extensionForMime(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('heic')) return 'heic'
  return 'jpg'
}

export type UploadChatMediaResult = {
  path: string
  mimeType: string
  fileName: string
  size: number
}

export async function uploadChatMedia(
  conversationId: string,
  userId: string,
  file: { blob: Blob; mimeType: string; fileName?: string },
): Promise<{ data: UploadChatMediaResult | null; error: string | null }> {
  const ext = file.fileName?.split('.').pop()?.toLowerCase() ?? extensionForMime(file.mimeType)
  const rand = Math.random().toString(36).slice(2, 10)
  // Path shape `chat/{conversationId}/...` satisfies the participant-scoped RLS policy.
  const path = `chat/${conversationId}/${userId}-${Date.now()}-${rand}.${ext}`

  const { error } = await supabase.storage.from(CHAT_FILES_BUCKET).upload(path, file.blob, {
    contentType: file.mimeType,
    upsert: true,
    cacheControl: '3600',
  })

  if (error) return { data: null, error: error.message }

  return {
    data: {
      path,
      mimeType: file.mimeType,
      fileName: file.fileName ?? `photo.${ext}`,
      size: file.blob.size,
    },
    error: null,
  }
}

export async function getChatMediaUrl(path: string): Promise<string | null> {
  if (!path) return null
  // Already an absolute URL (legacy rows).
  if (/^https?:\/\//i.test(path)) return path

  const { data, error } = await supabase.storage
    .from(CHAT_FILES_BUCKET)
    .createSignedUrl(path, 60 * 60)

  if (error) return null
  return data?.signedUrl ?? null
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

export async function updatePresence(userId: string, isOnline: boolean): Promise<void> {
  await supabase
    .from('profiles')
    .update({ is_online: isOnline, last_seen: new Date().toISOString() })
    .eq('id', userId)
}

// ---------------------------------------------------------------------------
// New-chat contact discovery
// ---------------------------------------------------------------------------

export type ChatCandidate = {
  id: string
  fullName: string
  username: string | null
  avatarUrl: string | null
  headline: string | null
  isOnline: boolean
}

type CandidateRow = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  headline: string | null
  is_online: boolean | null
}

// ---------------------------------------------------------------------------
// Participants (group chats: resolve sender names + avatars)
// ---------------------------------------------------------------------------

export type ParticipantRole = 'owner' | 'admin' | 'member'

export type ConversationParticipant = {
  userId: string
  name: string
  avatarUrl: string | null
  username: string | null
  headline: string | null
  role: ParticipantRole
  isOnline: boolean
}

type ParticipantRow = {
  user_id: string | null
  role: string | null
  profile: {
    id: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
    headline: string | null
    is_online: boolean | null
  } | null
}

function toParticipantRole(value: unknown): ParticipantRole {
  return value === 'owner' || value === 'admin' ? value : 'member'
}

export async function fetchConversationParticipants(
  conversationId: string,
): Promise<Record<string, ConversationParticipant>> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select(
      'user_id, role, profile:profiles!conversation_participants_user_id_fkey(id, full_name, username, avatar_url, headline, is_online)',
    )
    .eq('conversation_id', conversationId)

  if (error || !data) return {}

  const map: Record<string, ConversationParticipant> = {}
  for (const row of data as unknown as ParticipantRow[]) {
    const id = row.user_id ?? row.profile?.id
    if (!id) continue
    map[id] = {
      userId: id,
      name: row.profile?.full_name ?? row.profile?.username ?? 'Member',
      avatarUrl: row.profile?.avatar_url ?? null,
      username: row.profile?.username ?? null,
      headline: row.profile?.headline ?? null,
      role: toParticipantRole(row.role),
      isOnline: !!row.profile?.is_online,
    }
  }
  return map
}

/** Ordered participant list (owner → admins → members), for group info. */
export function sortParticipants(
  participants: Record<string, ConversationParticipant>,
): ConversationParticipant[] {
  const rank: Record<ParticipantRole, number> = { owner: 0, admin: 1, member: 2 }
  return Object.values(participants).sort((a, b) => {
    if (rank[a.role] !== rank[b.role]) return rank[a.role] - rank[b.role]
    return a.name.localeCompare(b.name)
  })
}

export async function fetchChatCandidates(
  currentUserId: string,
  search: string,
  limit = 30,
): Promise<{ items: ChatCandidate[]; error: string | null }> {
  let query = supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, headline, is_online')
    .eq('is_deleted', false)
    .neq('id', currentUserId)
    .not('full_name', 'is', null)
    .limit(limit)

  const trimmed = search.trim()
  if (trimmed) {
    query = query.or(`full_name.ilike.%${trimmed}%,username.ilike.%${trimmed}%`)
  } else {
    query = query.order('is_online', { ascending: false, nullsFirst: false }).order('full_name')
  }

  const { data, error } = await query
  if (error) return { items: [], error: error.message }

  const items = ((data ?? []) as CandidateRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name ?? row.username ?? 'Member',
    username: row.username,
    avatarUrl: row.avatar_url,
    headline: row.headline,
    isOnline: !!row.is_online,
  }))

  return { items, error: null }
}

// ---------------------------------------------------------------------------
// Forwarding
// ---------------------------------------------------------------------------

/**
 * Forward a message into another conversation. Media is re-uploaded into the
 * target conversation so recipients there can access it (storage is scoped per
 * conversation). Call logs are not forwardable.
 */
export async function forwardMessage(
  message: ChatMessage,
  toConversationId: string,
  senderId: string,
): Promise<{ error: string | null }> {
  try {
    if ((message.type === 'image' || message.type === 'file') && message.mediaUrl) {
      const sourceUrl = await getChatMediaUrl(message.mediaUrl)
      if (!sourceUrl) return { error: 'Media is no longer available.' }
      const blob = await (await fetch(sourceUrl)).blob()
      const mimeType =
        blob.type || (message.type === 'image' ? 'image/jpeg' : 'application/octet-stream')

      const { data: uploaded, error: uploadError } = await uploadChatMedia(
        toConversationId,
        senderId,
        { blob, mimeType, fileName: message.fileName ?? undefined },
      )
      if (uploadError || !uploaded) return { error: uploadError ?? 'Upload failed' }

      const { error } = await sendMessage({
        conversationId: toConversationId,
        senderId,
        content: '',
        type: message.type,
        mediaPath: uploaded.path,
        mediaType: mediaCategory(mimeType),
        fileName: uploaded.fileName,
        fileSize: uploaded.size,
      })
      return { error }
    }

    const { error } = await sendMessage({
      conversationId: toConversationId,
      senderId,
      content: message.content,
      type: 'text',
    })
    return { error }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not forward the message.' }
  }
}

// ---------------------------------------------------------------------------
// Starred (bookmarked) messages
// ---------------------------------------------------------------------------

export async function fetchStarredIds(
  userId: string,
  messageIds: string[],
): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set()
  const { data } = await supabase
    .from('message_stars')
    .select('message_id')
    .eq('user_id', userId)
    .in('message_id', messageIds)
  return new Set((data ?? []).map((r) => r.message_id as string))
}

export async function setMessageStarred(
  userId: string,
  messageId: string,
  starred: boolean,
): Promise<{ error: string | null }> {
  if (starred) {
    const { error } = await supabase
      .from('message_stars')
      .upsert({ user_id: userId, message_id: messageId }, { onConflict: 'user_id,message_id' })
    return { error: error?.message ?? null }
  }
  const { error } = await supabase
    .from('message_stars')
    .delete()
    .eq('user_id', userId)
    .eq('message_id', messageId)
  return { error: error?.message ?? null }
}

/** Starred messages within a conversation, newest first. */
export async function fetchStarredMessages(
  userId: string,
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data: stars } = await supabase
    .from('message_stars')
    .select('message_id')
    .eq('user_id', userId)
  const ids = (stars ?? []).map((r) => r.message_id as string)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .in('id', ids)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return (data as MessageRow[]).map(mapMessage)
}

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

export async function isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data } = await supabase
    .from('blocked_users')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
    .maybeSingle()
  return !!data
}

export async function setUserBlocked(
  blockerId: string,
  blockedId: string,
  blocked: boolean,
): Promise<{ error: string | null }> {
  if (blocked) {
    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: blockerId, blocked_id: blockedId })
    return { error: error?.message ?? null }
  }
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Group management
// ---------------------------------------------------------------------------

export async function addGroupParticipants(
  conversationId: string,
  userIds: string[],
): Promise<{ error: string | null }> {
  if (userIds.length === 0) return { error: null }
  const { error } = await supabase.rpc('add_group_participants', {
    p_conversation_id: conversationId,
    p_user_ids: userIds,
  })
  return { error: error?.message ?? null }
}

/** Remove a member (owner/admin) — or leave the group by passing your own id. */
export async function removeGroupParticipant(
  conversationId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('remove_group_participant', {
    p_conversation_id: conversationId,
    p_user_id: userId,
  })
  return { error: error?.message ?? null }
}

export async function updateGroupInfo(
  conversationId: string,
  input: { title?: string | null; avatarUrl?: string | null },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('update_group_info', {
    p_conversation_id: conversationId,
    p_title: input.title ?? undefined,
    p_avatar_url: input.avatarUrl ?? undefined,
  })
  return { error: error?.message ?? null }
}

export async function setGroupParticipantRole(
  conversationId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('set_group_participant_role', {
    p_conversation_id: conversationId,
    p_user_id: userId,
    p_role: role,
  })
  return { error: error?.message ?? null }
}

// ---------------------------------------------------------------------------
// Conversation info: profile + shared media
// ---------------------------------------------------------------------------

export type ContactProfile = {
  id: string
  fullName: string
  username: string | null
  avatarUrl: string | null
  headline: string | null
  bio: string | null
  isOnline: boolean
  lastSeen: string | null
}

export async function fetchContactProfile(userId: string): Promise<ContactProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, headline, bio, is_online, last_seen')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as {
    id: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
    headline: string | null
    bio: string | null
    is_online: boolean | null
    last_seen: string | null
  }
  return {
    id: row.id,
    fullName: row.full_name ?? row.username ?? 'Member',
    username: row.username,
    avatarUrl: row.avatar_url,
    headline: row.headline,
    bio: row.bio,
    isOnline: !!row.is_online,
    lastSeen: row.last_seen,
  }
}

export type SharedMediaItem = {
  id: string
  type: ChatMessageType
  mediaUrl: string | null
  fileName: string | null
}

/** Recent image/file messages shared in a conversation (newest first). */
export async function fetchSharedMedia(
  conversationId: string,
  limit = 60,
): Promise<SharedMediaItem[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, message_type, media_url, media_type, file_name, metadata, content, deleted_at, created_at')
    .eq('conversation_id', conversationId)
    .in('message_type', ['image', 'file'])
    .is('deleted_at', null)
    .not('media_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return (data as MessageRow[]).map((row) => ({
    id: row.id,
    type: toMessageType(row.message_type),
    mediaUrl: row.media_url,
    fileName: row.file_name,
  }))
}
