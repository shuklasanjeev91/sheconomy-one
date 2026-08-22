export type ChatType = 'direct' | 'group'

export type MessageDeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

export type ChatMessageType = 'text' | 'image' | 'file' | 'call' | 'system' | 'poll' | 'event' | 'listing'

/** Poll payload carried in `messages.metadata` for `poll` messages. */
export type ChatPollPayload = {
  question: string
  options: string[]
  /** Pre-counted votes from legacy messages (metadata.votes), added on top of live votes. */
  baseCounts?: number[]
}

/** Event payload carried in `messages.metadata` for `event` messages. */
export type ChatEventPayload = {
  eventId: string
  title: string
  startTime: string | null
  location: string | null
  imageUrl: string | null
  /** Legacy events have no backing `events` row, so RSVP is disabled. */
  isStatic?: boolean
}

/** Story reply payload carried in `messages.metadata` for text DMs from the story viewer. */
export type ChatStoryReplyPayload = {
  storyId: string
  authorId: string | null
  previewUrl: string | null
  previewText: string | null
}

/** A conversation row as surfaced in the chat list (from `get_user_chats`). */
export type ChatSummary = {
  id: string
  name: string
  type: ChatType
  lastMessage: string
  lastMessageType: string
  lastMessageTime: string | null
  lastMessageSenderName: string | null
  unreadCount: number
  avatarUrl: string | null
  otherUserId: string | null
  otherUserName: string | null
  otherUserAvatar: string | null
  isOnline: boolean
  lastSeen: string | null
  currentUserRole: string
  isPinned: boolean
  isMuted: boolean
  isArchived: boolean
}

/** A compact snapshot of the message being replied to (quoted block). */
export type ReplyPreview = {
  id: string
  senderId: string | null
  content: string
  type: ChatMessageType
  mediaUrl: string | null
}

/** Listing/product payload carried in `messages.metadata` for `listing` messages. */
export type ChatListingPayload = {
  listingId: string
  title: string
  price: number | null
  currency: string | null
  imageUrl: string | null
  slug: string | null
  shopName: string | null
  /** Originating community post when shared from a shoppable post. */
  postId?: string | null
  /** Commerce attribution source (feed, chat, profile_shop, …). */
  source?: string | null
  shopOwnerUserId?: string | null
}

/** A single message within a conversation thread. */
export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string | null
  content: string
  type: ChatMessageType
  /** Storage path in the `chat-files` bucket (resolved to a signed URL on render). */
  mediaUrl: string | null
  mediaType: string | null
  fileName: string | null
  fileSize: number | null
  status: MessageDeliveryStatus
  createdAt: string
  /** Id of the message this one replies to (quoted). */
  replyToId: string | null
  /** Resolved snapshot of the replied-to message, when available. */
  replyPreview: ReplyPreview | null
  /** Set when the message was deleted for everyone (tombstone). */
  deletedAt: string | null
  /** Set when the message text was edited. */
  editedAt: string | null
  /** Poll definition for `poll` messages (parsed from metadata). */
  poll: ChatPollPayload | null
  /** Event reference for `event` messages (parsed from metadata). */
  event: ChatEventPayload | null
  /** Product/listing card for `listing` messages. */
  listing: ChatListingPayload | null
  /** Story reply reference for DMs sent from the story viewer. */
  storyReply: ChatStoryReplyPayload | null
  /** Client-only optimistic marker until the server row is confirmed. */
  optimistic?: boolean
}

/** One user's vote on a chat poll message. */
export type MessagePollVote = {
  messageId: string
  userId: string
  optionIndex: number
}

/** Aggregated poll results for rendering a chat poll message. */
export type PollResult = {
  counts: number[]
  total: number
  myOptionIndex: number | null
}

/** One user's reaction to a message. */
export type MessageReaction = {
  messageId: string
  userId: string
  emoji: string
}

/** Reactions on a message aggregated by emoji for rendering. */
export type ReactionGroup = {
  emoji: string
  count: number
  mine: boolean
}

export type TypingParticipant = {
  userId: string
}

export type ChatComposerAttachment = {
  uri: string
  mimeType: string
  fileName?: string
  fileSize?: number
}
