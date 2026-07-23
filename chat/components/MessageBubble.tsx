import { memo } from 'react'
import { Platform } from 'react-native'

import { useChatTheme } from '~/chat/lib/chat-theme'
import { formatBubbleTime } from '~/chat/lib/time'
import { mediaPreviewLabel } from '~/chat/lib/emoji'
import { extractFirstUrl } from '~/chat/lib/link-preview'
import type { ChatMessage, PollResult, ReactionGroup } from '~/chat/lib/types'
import { Avatar, Icons, Image, Text, XStack, YStack } from '~/components/ui'

import { ChatAudioMessage } from './ChatAudioMessage'
import { ChatMediaImage } from './ChatMediaImage'
import { ChatMediaVideo } from './ChatMediaVideo'
import { EventMessage } from './EventMessage'
import { LinkPreviewCard } from './LinkPreviewCard'
import { PollMessage } from './PollMessage'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { communityRoutes } from '~/lib/routes'
import { pressNavigate } from '~/components/navigation/AppLink'

type MessageBubbleProps = {
  message: ChatMessage
  isOwn: boolean
  showTail: boolean
  /** The other participant has read up to this message → blue double-tick. */
  readByPeer?: boolean
  /** Group threads: sender label shown at the top of the first bubble in a run. */
  senderName?: string | null
  /** Group threads: avatar for the sender, rendered on the last bubble in a run. */
  senderAvatarUrl?: string | null
  /** Group threads: reserve the avatar gutter so incoming bubbles align. */
  reserveAvatarGutter?: boolean
  /** Group threads: render the avatar (last incoming bubble in a run). */
  showAvatar?: boolean
  /** Consistent per-sender color for the name label. */
  nameColor?: string
  /** Aggregated reactions to render beneath the bubble. */
  reactions?: ReactionGroup[]
  /** Display name of the author of the quoted (replied-to) message. */
  replySenderName?: string | null
  onRequestActions?: () => void
  onReactionPress?: (emoji: string) => void
  /** Retry sending a failed message (own messages only). */
  onRetry?: () => void
  /** Open a shared document (file messages). */
  onOpenFile?: () => void
  /** Re-initiate a call from a call-log entry. */
  onCallBack?: () => void
  /** Show a star indicator when the message is bookmarked. */
  isStarred?: boolean
  /** Selection mode: render a checkbox and route taps to toggle selection. */
  selectionMode?: boolean
  /** Whether this message is currently selected. */
  selected?: boolean
  /** Toggle this message's selection. */
  onToggleSelect?: () => void
  /** Highlight matches of this term inside the message text (in-chat search). */
  highlightTerm?: string | null
  /** Aggregated poll results (for `poll` messages). */
  pollResult?: PollResult
  /** Cast a vote on a poll message. */
  onVotePoll?: (optionIndex: number) => void
  /** Current viewer id (event RSVP + poll vote attribution). */
  currentUserId?: string | null
}

const URL_RE = /(https?:\/\/[^\s]+)/gi

/** Text with in-line search highlighting. */
function HighlightedText({
  text,
  highlight,
  highlightBg,
}: {
  text: string
  highlight?: string | null
  highlightBg: string
}) {
  if (!highlight) return <>{text}</>
  const term = highlight.toLowerCase()
  const lower = text.toLowerCase()
  const parts: (string | React.ReactElement)[] = []
  let cursor = 0
  let index = lower.indexOf(term)
  let key = 0
  while (index !== -1) {
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(
      <Text key={`h${key++}`} backgroundColor={highlightBg}>
        {text.slice(index, index + term.length)}
      </Text>,
    )
    cursor = index + term.length
    index = lower.indexOf(term, cursor)
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

/** Message body with tappable links and optional search highlighting. */
function RichMessageText({
  content,
  color,
  linkColor,
  fontSize,
  lineHeight,
  highlight,
  highlightBg,
}: {
  content: string
  color: string
  linkColor: string
  fontSize: number
  lineHeight: number
  highlight?: string | null
  highlightBg: string
}) {
  const segments = content.split(URL_RE)
  return (
    <Text fontSize={fontSize} lineHeight={lineHeight} color={color}>
      {segments.map((segment, i) => {
        if (!segment) return null
        if (/^https?:\/\//i.test(segment)) {
          return (
            <Text
              key={`u${i}`}
              color={linkColor}
              textDecorationLine="underline"
              onPress={() => {
                void openExternalUrl(segment)
              }}
            >
              {segment}
            </Text>
          )
        }
        return (
          <HighlightedText key={`t${i}`} text={segment} highlight={highlight} highlightBg={highlightBg} />
        )
      })}
    </Text>
  )
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\uFE0F|\u200D|\s|\p{Emoji_Modifier}|[\u{1F1E6}-\u{1F1FF}])+$/u

function isEmojiOnly(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  try {
    if (!EMOJI_ONLY.test(trimmed)) return false
    return Array.from(trimmed.replace(/\s/g, '')).length <= 8
  } catch {
    return false
  }
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StatusTicks({
  status,
  color,
  readColor,
}: {
  status: ChatMessage['status']
  color: string
  readColor: string
}) {
  // WhatsApp-style: clock → ✓ → ✓✓ → blue ✓✓
  if (status === 'sending') return <Icons.Clock size={13} color={color} strokeWidth={2.4} />
  if (status === 'failed') return <Icons.AlertCircle size={13} color="#ef4444" strokeWidth={2.4} />
  if (status === 'read') {
    return <Icons.CheckCheck size={15} color={readColor} strokeWidth={2.6} />
  }
  if (status === 'delivered') {
    return <Icons.CheckCheck size={15} color={color} strokeWidth={2.6} />
  }
  // sent (server accepted, not yet delivered)
  return <Icons.Check size={15} color={color} strokeWidth={2.6} />
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showTail,
  readByPeer,
  senderName,
  senderAvatarUrl,
  reserveAvatarGutter,
  showAvatar,
  nameColor,
  reactions,
  replySenderName,
  onRequestActions,
  onReactionPress,
  onRetry,
  onOpenFile,
  onCallBack,
  isStarred,
  selectionMode,
  selected,
  onToggleSelect,
  highlightTerm,
  pollResult,
  onVotePoll,
  currentUserId,
}: MessageBubbleProps) {
  const chat = useChatTheme()
  const isDeleted = !!message.deletedAt
  const isCall = message.type === 'call'
  const isPoll = !isDeleted && message.type === 'poll' && !!message.poll
  const isEvent = !isDeleted && message.type === 'event' && !!message.event
  const isImage = !isDeleted && message.type === 'image' && !!message.mediaUrl
  const isAudio =
    !isDeleted && message.type === 'file' && message.mediaType === 'audio' && !!message.mediaUrl
  const isVideo =
    !isDeleted &&
    !!message.mediaUrl &&
    (message.mediaType === 'video' ||
      (message.type === 'file' && !!message.mediaType?.startsWith('video')))
  const isFile = !isDeleted && !isAudio && !isVideo && message.type === 'file' && !!message.mediaUrl
  const hasText =
    !isDeleted && !isCall && !isPoll && !isEvent && message.content.trim().length > 0
  const quote = !isDeleted ? message.replyPreview : null
  const bigEmoji = hasText && message.type === 'text' && !quote && isEmojiOnly(message.content)
  const previewUrl =
    hasText && message.type === 'text' && !bigEmoji ? extractFirstUrl(message.content) : null

  const effectiveStatus: ChatMessage['status'] =
    isOwn && readByPeer && message.status !== 'sending' && message.status !== 'failed'
      ? 'read'
      : message.status

  const bg = isOwn ? chat.bubbleOut : chat.bubbleIn
  const textColor = isOwn ? chat.bubbleOutText : chat.bubbleInText
  const metaColor = isOwn ? chat.bubbleMetaOut : chat.bubbleMetaIn

  const pressProps = selectionMode
    ? { onPress: onToggleSelect }
    : isDeleted
      ? {}
      : isCall
        ? { onPress: onCallBack }
        : isPoll || isEvent
          ? // Interactive controls live inside; only long-press opens actions (native).
            Platform.OS === 'web'
            ? {}
            : { onLongPress: onRequestActions, delayLongPress: 280 }
          : isFile
            ? Platform.OS === 'web'
              ? { onPress: onOpenFile }
              : { onPress: onOpenFile, onLongPress: onRequestActions, delayLongPress: 280 }
            : onRequestActions
              ? Platform.OS === 'web'
                ? { onPress: onRequestActions }
                : { onLongPress: onRequestActions, delayLongPress: 280 }
              : {}

  const callParts = isCall ? message.content.split('|') : []
  const callKind = callParts[0] === 'video' ? 'video' : 'audio'
  const callOutcome = callParts[1] ?? 'answered'
  const callMissed = callOutcome === 'missed'
  const callPrimary = callKind === 'video' ? 'Video call' : 'Voice call'
  const callSecondary = callMissed
    ? 'Missed'
    : callOutcome === 'declined'
      ? isOwn
        ? 'Declined'
        : 'You declined'
      : isOwn
        ? 'Outgoing'
        : 'Incoming'

  const quotePreviewText = quote
    ? quote.content.trim().length > 0
      ? quote.content
      : mediaPreviewLabel(quote.type)
    : ''

  return (
    <XStack
      width="100%"
      justifyContent={isOwn ? 'flex-end' : 'flex-start'}
      alignItems={selectionMode ? 'center' : 'flex-end'}
      paddingHorizontal="$3"
      gap={6}
      marginTop={showTail ? 6 : 2}
      backgroundColor={selected ? chat.listItemActive : undefined}
      {...(selectionMode ? { onPress: onToggleSelect, cursor: 'pointer' } : {})}
    >
      {selectionMode ? (
        <YStack width={26} alignItems="center" justifyContent="center">
          {selected ? (
            <Icons.CheckCircle2 size={22} color={chat.brand} />
          ) : (
            <Icons.Circle size={22} color={chat.textMuted} />
          )}
        </YStack>
      ) : null}

      {reserveAvatarGutter && !isOwn ? (
        <YStack width={28} alignItems="center" justifyContent="flex-end">
          {showAvatar ? (
            <Avatar size="$2" name={senderName ?? 'Member'} src={senderAvatarUrl ?? undefined} />
          ) : null}
        </YStack>
      ) : null}

      <YStack maxWidth="82%" alignItems={isOwn ? 'flex-end' : 'flex-start'}>
        <YStack
          {...pressProps}
          cursor={onRequestActions && !isDeleted ? 'pointer' : 'default'}
          backgroundColor={bg}
          paddingHorizontal={isImage && !hasText ? 4 : 9}
          paddingTop={isImage ? 4 : 6}
          paddingBottom={4}
          borderRadius={14}
          borderTopLeftRadius={!isOwn && showTail ? 3 : 14}
          borderTopRightRadius={isOwn && showTail ? 3 : 14}
          gap={isImage ? 4 : 2}
          {...(isOwn
            ? { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 1, shadowOffset: { width: 0, height: 1 } }
            : { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 1, shadowOffset: { width: 0, height: 1 } })}
        >
          {!isOwn && senderName ? (
            <Text fontSize={12.5} fontWeight="700" color={nameColor ?? chat.brand} numberOfLines={1}>
              {senderName}
            </Text>
          ) : null}

          {quote ? (
            <YStack
              backgroundColor={chat.quoteBg}
              borderLeftWidth={3}
              borderLeftColor={chat.quoteBar}
              borderTopLeftRadius={4}
              borderBottomLeftRadius={4}
              borderTopRightRadius={6}
              borderBottomRightRadius={6}
              paddingVertical={4}
              paddingHorizontal={8}
              marginBottom={3}
              gap={1}
            >
              <Text fontSize={12} fontWeight="700" color={chat.quoteBar} numberOfLines={1}>
                {replySenderName ?? 'Message'}
              </Text>
              <XStack alignItems="center" gap={4}>
                {quote.type === 'image' ? <Icons.Camera size={12} color={chat.quoteText} /> : null}
                <Text fontSize={13} color={chat.quoteText} numberOfLines={1}>
                  {quotePreviewText}
                </Text>
              </XStack>
            </YStack>
          ) : null}

          {isImage ? <ChatMediaImage path={message.mediaUrl as string} /> : null}
          {isVideo ? <ChatMediaVideo path={message.mediaUrl as string} /> : null}

          {isAudio ? (
            <ChatAudioMessage
              path={message.mediaUrl as string}
              tint={metaColor}
              trackColor={isOwn ? chat.bubbleMetaOut : chat.border}
              fillColor={chat.brand}
            />
          ) : null}

          {isCall ? (
            <XStack alignItems="center" gap={10} paddingVertical={2} paddingRight={6}>
              <YStack
                width={34}
                height={34}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                backgroundColor={callMissed ? '#f2385a22' : chat.reactionBg}
              >
                {callKind === 'video' ? (
                  <Icons.Video size={18} color={callMissed ? '#f2385a' : chat.brand} />
                ) : (
                  <Icons.Phone size={17} color={callMissed ? '#f2385a' : chat.brand} />
                )}
              </YStack>
              <YStack gap={1}>
                <Text fontSize={15} fontWeight="600" color={textColor}>
                  {callPrimary}
                </Text>
                <XStack alignItems="center" gap={4}>
                  <Icons.ArrowUpRight
                    size={12}
                    color={callMissed ? '#f2385a' : metaColor}
                    style={{ transform: [{ rotate: isOwn ? '0deg' : '90deg' }] }}
                  />
                  <Text fontSize={12.5} color={callMissed ? '#f2385a' : metaColor}>
                    {callSecondary}
                  </Text>
                </XStack>
              </YStack>
              <YStack flex={1} />
              <Icons.Phone size={18} color={chat.brand} />
            </XStack>
          ) : null}

          {isFile ? (
            <XStack alignItems="center" gap={10} paddingVertical={2} paddingRight={4} maxWidth={240}>
              <YStack
                width={38}
                height={38}
                borderRadius={10}
                alignItems="center"
                justifyContent="center"
                backgroundColor={chat.reactionBg}
              >
                <Icons.FileText size={20} color={chat.brand} />
              </YStack>
              <YStack flex={1} minWidth={0}>
                <Text fontSize={14.5} fontWeight="600" color={textColor} numberOfLines={1}>
                  {message.fileName ?? 'Document'}
                </Text>
                {formatFileSize(message.fileSize) ? (
                  <Text fontSize={12} color={metaColor}>
                    {formatFileSize(message.fileSize)}
                  </Text>
                ) : null}
              </YStack>
              <Icons.Download size={18} color={metaColor} />
            </XStack>
          ) : null}

          {isPoll && message.poll ? (
            <PollMessage
              poll={message.poll}
              result={pollResult}
              isOwn={isOwn}
              onVote={(optionIndex) => onVotePoll?.(optionIndex)}
            />
          ) : null}

          {isEvent && message.event ? (
            <EventMessage event={message.event} isOwn={isOwn} currentUserId={currentUserId ?? null} />
          ) : null}

          {message.storyReply ? (
            <XStack
              alignItems="center"
              gap={8}
              paddingVertical={4}
              paddingHorizontal={2}
              marginBottom={2}
              maxWidth={240}
              cursor={message.storyReply.authorId ? 'pointer' : 'default'}
              onPress={
                message.storyReply.authorId
                  ? () => pressNavigate(communityRoutes.storyUser(message.storyReply!.authorId as string))
                  : undefined
              }
              accessibilityLabel="Open story reply"
            >
              <YStack
                width={40}
                height={40}
                borderRadius={8}
                overflow="hidden"
                backgroundColor={chat.reactionBg}
                alignItems="center"
                justifyContent="center"
              >
                {message.storyReply.previewUrl ? (
                  <Image
                    source={{ uri: message.storyReply.previewUrl }}
                    style={{ width: 40, height: 40 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Icons.Image size={18} color={chat.brand} />
                )}
              </YStack>
              <YStack flex={1} minWidth={0} gap={1}>
                <Text fontSize={11} fontWeight="700" color={chat.brand}>
                  Story reply
                </Text>
                <Text fontSize={12} color={metaColor} numberOfLines={2}>
                  {message.storyReply.previewText?.trim() || 'Replied to a story'}
                </Text>
              </YStack>
            </XStack>
          ) : null}

          {previewUrl ? <LinkPreviewCard url={previewUrl} isOwn={isOwn} /> : null}

          {isDeleted ? (
            <XStack alignItems="center" gap={5} paddingVertical={2}>
              <Icons.Ban size={14} color={metaColor} />
              <Text fontSize={14.5} fontStyle="italic" color={metaColor}>
                This message was deleted
              </Text>
            </XStack>
          ) : hasText ? (
            bigEmoji ? (
              <Text fontSize={40} lineHeight={48} color={textColor}>
                {message.content}
              </Text>
            ) : (
              <RichMessageText
                content={message.content}
                color={textColor}
                linkColor={isOwn ? chat.bubbleOutText : chat.brand}
                fontSize={15}
                lineHeight={20}
                highlight={highlightTerm}
                highlightBg={chat.reactionMineBorder}
              />
            )
          ) : null}

          <XStack
            alignSelf="flex-end"
            alignItems="center"
            gap={4}
            marginTop={hasText || !isImage ? 0 : 2}
          >
            {isStarred && !isDeleted ? <Icons.Star size={11} color={metaColor} /> : null}
            {message.editedAt && !isDeleted ? (
              <Text fontSize={11} fontStyle="italic" color={metaColor}>
                edited
              </Text>
            ) : null}
            <Text fontSize={11} color={metaColor}>
              {formatBubbleTime(message.createdAt)}
            </Text>
            {isOwn && !isDeleted && !isCall ? (
              effectiveStatus === 'failed' && onRetry ? (
                <XStack
                  alignItems="center"
                  gap={3}
                  onPress={onRetry}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.6 }}
                  aria-label="Retry sending"
                >
                  <Icons.RotateCcw size={12} color="#ef4444" />
                  <Text fontSize={11} fontWeight="700" color="#ef4444">
                    Retry
                  </Text>
                </XStack>
              ) : (
                <StatusTicks status={effectiveStatus} color={chat.tick} readColor={chat.tickRead} />
              )
            ) : null}
          </XStack>
        </YStack>

        {reactions && reactions.length > 0 ? (
          <XStack gap={4} marginTop={-6} marginBottom={2} zIndex={1} flexWrap="wrap">
            {reactions.map((r) => (
              <XStack
                key={r.emoji}
                onPress={() => onReactionPress?.(r.emoji)}
                cursor="pointer"
                alignItems="center"
                gap={2}
                paddingHorizontal={7}
                height={22}
                borderRadius={999}
                borderWidth={1}
                backgroundColor={r.mine ? chat.reactionMineBg : chat.reactionBg}
                borderColor={r.mine ? chat.reactionMineBorder : chat.border}
                pressStyle={{ scale: 0.92 }}
                animation="quick"
              >
                <Text fontSize={13}>{r.emoji}</Text>
                {r.count > 1 ? (
                  <Text fontSize={11} fontWeight="700" color={chat.reactionText}>
                    {r.count}
                  </Text>
                ) : null}
              </XStack>
            ))}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  )
})
