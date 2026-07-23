import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Share } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { FlashList, type FlashListRef } from '@shopify/flash-list'

import { usePeerPresence } from '~/chat/hooks/usePeerPresence'
import { useConversation } from '~/chat/hooks/useConversation'
import { useConversationParticipants } from '~/chat/hooks/useConversationParticipants'
import { useOutgoingCall } from '~/chat/hooks/useOutgoingCall'
import {
  clearConversation,
  fetchDisappearingSeconds,
  fetchStarredIds,
  forwardMessage,
  getChatMediaUrl,
  isUserBlocked,
  removeGroupParticipant,
  setConversationArchived,
  setConversationMuted,
  setDisappearingSeconds,
  setMessageStarred,
  setUserBlocked,
} from '~/chat/lib/chats'
import { getSenderColor } from '~/chat/lib/sender-color'
import { isNewDay, formatDaySeparator } from '~/chat/lib/time'
import type { ChatMessage, ChatSummary } from '~/chat/lib/types'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { openExternalUrl } from '~/lib/platform/openUrl'
import {
  AppBottomSheet,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { useIsDarkTheme } from '~/lib/theme/useAppUi'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { BRAND_NAME } from '~/config/brand'

import { CallOverlay } from './CallOverlay'
import { ChatThreadHeader } from './ChatThreadHeader'
import { ConversationInfoSheet } from './ConversationInfoSheet'
import { DateSeparator } from './DateSeparator'
import { EventPickerSheet } from './EventPickerSheet'
import { ForwardSheet } from './ForwardSheet'
import { StarredMessagesSheet } from './StarredMessagesSheet'
import { MessageActionsSheet } from './MessageActionsSheet'
import { MessageBubble } from './MessageBubble'
import { MessageComposer } from './MessageComposer'
import { PollComposerSheet } from './PollComposerSheet'
import { TypingBubble } from './TypingBubble'

type ChatThreadPaneProps = {
  chat: ChatSummary
  currentUserId: string
  onBack: () => void
  /** Notify the parent (list) to refresh after mute/clear changes. */
  onConversationChanged?: () => void
}

/** Distance from the top (px) at which we begin loading older messages. */
const LOAD_OLDER_THRESHOLD = 120
/** How close to the bottom (px) still counts as "at the bottom" for auto-scroll. */
const NEAR_BOTTOM_THRESHOLD = 160

/** Disappearing-message timer presets. */
const DISAPPEARING_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: 'Off', seconds: null },
  { label: '24 hours', seconds: 24 * 60 * 60 },
  { label: '7 days', seconds: 7 * 24 * 60 * 60 },
  { label: '90 days', seconds: 90 * 24 * 60 * 60 },
]

function disappearingLabel(seconds: number | null): string {
  const match = DISAPPEARING_OPTIONS.find((o) => o.seconds === seconds)
  return match ? match.label : 'Off'
}

function HeaderIconButton({
  children,
  onPress,
  label,
}: {
  children: React.ReactNode
  onPress: () => void
  label: string
}) {
  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      width={40}
      height={40}
      borderRadius={999}
      alignItems="center"
      justifyContent="center"
      pressStyle={{ scale: 0.9 }}
      animation="quick"
      aria-label={label}
    >
      {children}
    </XStack>
  )
}

export function ChatThreadPane({
  chat,
  currentUserId,
  onBack,
  onConversationChanged,
}: ChatThreadPaneProps) {
  const theme = useChatTheme()
  const isDark = useIsDarkTheme()
  const scrollRef = useRef<FlashListRef<ChatMessage>>(null)
  const isGroup = chat.type === 'group'

  // Scroll bookkeeping for infinite scroll + smart auto-scroll.
  const scrollYRef = useRef(0)
  const viewportHeightRef = useRef(0)
  const contentHeightRef = useRef(0)
  const prevContentHeightRef = useRef(0)
  const pendingPrependRef = useRef(false)
  const lastMessageIdRef = useRef<string | null>(null)
  const atBottomRef = useRef(true)

  // Interaction state.
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null)
  const [editingTarget, setEditingTarget] = useState<ChatMessage | null>(null)
  const [actionsMessage, setActionsMessage] = useState<ChatMessage | null>(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Forward / star / starred-view / block state.
  const [forwardIds, setForwardIds] = useState<string[] | null>(null)
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())
  const [starredOpen, setStarredOpen] = useState(false)
  const [blocked, setBlocked] = useState(false)

  // In-chat search.
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)

  // Multi-select.
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Disappearing messages.
  const [disappearingSeconds, setDisappearingSecondsState] = useState<number | null>(null)
  const [disappearOpen, setDisappearOpen] = useState(false)

  // Poll / event composers.
  const [pollComposerOpen, setPollComposerOpen] = useState(false)
  const [eventPickerOpen, setEventPickerOpen] = useState(false)

  const toast = useAppToast()

  // Local overrides for immediate feedback on mute / clear.
  const [mutedOverride, setMutedOverride] = useState<boolean | null>(null)
  const [clearedAt, setClearedAt] = useState<string | null>(null)

  const presence = usePeerPresence(chat.otherUserId, {
    isOnline: chat.isOnline,
    lastSeen: chat.lastSeen,
  })

  const participants = useConversationParticipants(chat.id, isGroup)

  const {
    messages,
    isLoading,
    hasMore,
    loadingOlder,
    loadOlder,
    sending,
    uploadProgress,
    peerTyping,
    peerReadAt,
    reactionsByMessage,
    pollResultsByMessage,
    send,
    resend,
    sendImage,
    sendFile,
    sendPoll,
    sendEvent,
    votePoll,
    edit,
    remove,
    react,
    handleTyping,
  } = useConversation({ conversationId: chat.id, currentUserId })

  const { outgoing, start: startOutgoingCall, cancel: cancelOutgoingCall } = useOutgoingCall(currentUserId)
  const canCall = chat.type === 'direct' ? !!chat.otherUserId : chat.type === 'group'

  const isMuted = mutedOverride ?? chat.isMuted

  const resolveSenderName = useCallback(
    (senderId: string | null): string => {
      if (!senderId) return 'Message'
      if (senderId === currentUserId) return 'You'
      if (isGroup) return participants[senderId]?.name ?? 'Member'
      return chat.otherUserName ?? chat.name
    },
    [chat.name, chat.otherUserName, currentUserId, isGroup, participants],
  )

  const disappearCutoff = disappearingSeconds
    ? new Date(Date.now() - disappearingSeconds * 1000).toISOString()
    : null

  const visibleMessages = useMemo(() => {
    let list = messages
    if (clearedAt) list = list.filter((m) => m.createdAt > clearedAt)
    if (disappearCutoff) list = list.filter((m) => m.createdAt >= disappearCutoff)
    return list
  }, [messages, clearedAt, disappearCutoff])

  // Search matches (over currently loaded messages), newest first for navigation.
  const trimmedQuery = searchQuery.trim().toLowerCase()
  const matchIds = useMemo(() => {
    if (!trimmedQuery) return [] as string[]
    return visibleMessages
      .filter((m) => !m.deletedAt && m.content.toLowerCase().includes(trimmedQuery))
      .map((m) => m.id)
  }, [visibleMessages, trimmedQuery])

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const message = visibleMessages.find((m) => m.id === messageId)
      if (message) {
        scrollRef.current?.scrollToItem({ item: message, animated: true, viewPosition: 0.2 })
      }
    },
    [visibleMessages],
  )

  useEffect(() => {
    if (matchIds.length === 0) return
    const clamped = Math.min(matchIndex, matchIds.length - 1)
    scrollToMessage(matchIds[clamped])
  }, [matchIndex, matchIds, scrollToMessage])

  const gotoMatch = useCallback(
    (dir: 1 | -1) => {
      if (matchIds.length === 0) return
      setMatchIndex((prev) => {
        const next = (prev + dir + matchIds.length) % matchIds.length
        return next
      })
    },
    [matchIds.length],
  )

  // Load the disappearing-messages setting for this conversation.
  useEffect(() => {
    let cancelled = false
    fetchDisappearingSeconds(chat.id).then((seconds) => {
      if (!cancelled) setDisappearingSecondsState(seconds)
    })
    return () => {
      cancelled = true
    }
  }, [chat.id])

  const openFile = useCallback(async (message: ChatMessage) => {
    if (!message.mediaUrl) return
    const url = await getChatMediaUrl(message.mediaUrl)
    if (url) void openExternalUrl(url)
  }, [])

  // Load which of the loaded messages are starred.
  const messageIdsKey = messages.map((m) => m.id).join(',')
  useEffect(() => {
    if (!currentUserId) return
    const ids = messageIdsKey ? messageIdsKey.split(',') : []
    if (ids.length === 0) return
    let cancelled = false
    fetchStarredIds(currentUserId, ids).then((set) => {
      if (!cancelled) setStarredIds(set)
    })
    return () => {
      cancelled = true
    }
  }, [currentUserId, messageIdsKey])

  // Check whether the current user has blocked the peer (direct chats).
  useEffect(() => {
    if (chat.type !== 'direct' || !chat.otherUserId) return
    let cancelled = false
    isUserBlocked(currentUserId, chat.otherUserId).then((v) => {
      if (!cancelled) setBlocked(v)
    })
    return () => {
      cancelled = true
    }
  }, [chat.type, chat.otherUserId, currentUserId])

  const toggleStar = useCallback(
    (message: ChatMessage) => {
      const willStar = !starredIds.has(message.id)
      setStarredIds((prev) => {
        const next = new Set(prev)
        if (willStar) next.add(message.id)
        else next.delete(message.id)
        return next
      })
      void setMessageStarred(currentUserId, message.id, willStar)
    },
    [currentUserId, starredIds],
  )

  const exitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  const toggleSelect = useCallback((messageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      if (next.size === 0) setSelectionMode(false)
      return next
    })
  }, [])

  const enterSelection = useCallback((message: ChatMessage) => {
    setSelectionMode(true)
    setSelectedIds(new Set([message.id]))
  }, [])

  const handleForward = useCallback(
    async (target: ChatSummary) => {
      const ids = forwardIds ?? []
      setForwardIds(null)
      if (ids.length === 0) return
      const toForward = messages.filter((m) => ids.includes(m.id))
      let failed = 0
      for (const message of toForward) {
        const { error } = await forwardMessage(message, target.id, currentUserId)
        if (error) failed += 1
      }
      exitSelection()
      toast.show(
        failed ? 'Some messages could not be forwarded' : `Forwarded to ${target.name}`,
        { tone: failed ? 'danger' : 'default' },
      )
    },
    [forwardIds, messages, currentUserId, exitSelection, toast],
  )

  const bulkDelete = useCallback(() => {
    const ids = [...selectedIds]
    for (const id of ids) {
      const message = messages.find((m) => m.id === id)
      if (message && message.senderId === currentUserId && !message.deletedAt) {
        void remove(id)
      }
    }
    exitSelection()
  }, [selectedIds, messages, currentUserId, remove, exitSelection])

  const bulkStar = useCallback(() => {
    const ids = [...selectedIds]
    setStarredIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
    ids.forEach((id) => void setMessageStarred(currentUserId, id, true))
    exitSelection()
    toast.show(`Starred ${ids.length} message${ids.length > 1 ? 's' : ''}`, { tone: 'default' })
  }, [selectedIds, currentUserId, exitSelection, toast])

  const selectedDeletableCount = useMemo(
    () =>
      [...selectedIds].filter((id) => {
        const message = messages.find((m) => m.id === id)
        return message && message.senderId === currentUserId && !message.deletedAt
      }).length,
    [selectedIds, messages, currentUserId],
  )

  const handleDisappearingPick = useCallback(
    async (seconds: number | null) => {
      setDisappearOpen(false)
      setDisappearingSecondsState(seconds)
      const { error } = await setDisappearingSeconds(chat.id, seconds)
      toast.show(
        error
          ? 'Could not update disappearing messages'
          : seconds
            ? `Disappearing messages: ${disappearingLabel(seconds)}`
            : 'Disappearing messages off',
        { tone: error ? 'danger' : 'default' },
      )
    },
    [chat.id, toast],
  )

  const handleBlockToggle = useCallback(async () => {
    if (!chat.otherUserId) return
    setMenuOpen(false)
    const next = !blocked
    setBlocked(next)
    const { error } = await setUserBlocked(currentUserId, chat.otherUserId, next)
    if (error) {
      setBlocked(!next)
      toast.show('Could not update block', { tone: 'danger' })
    } else {
      toast.show(next ? `Blocked ${chat.name}` : `Unblocked ${chat.name}`, { tone: 'default' })
    }
  }, [blocked, chat.name, chat.otherUserId, currentUserId, toast])

  async function handleShareChatSummary() {
    setMenuOpen(false)
    const recent = visibleMessages
      .filter((message) => !message.deletedAt && message.content.trim())
      .slice(-30)
    if (!recent.length) {
      toast.show('No messages to share yet', { tone: 'info' })
      return
    }
    const lines = recent.map((message) => {
      const who = message.senderId === currentUserId ? 'You' : resolveSenderName(message.senderId)
      const body = message.content.replace(/\s+/g, ' ').slice(0, 160)
      return `${who}: ${body}`
    })
    const message = [`Chat with ${chat.name} · ${BRAND_NAME}`, '', ...lines].join('\n')
    try {
      await Share.share({ title: `Chat · ${chat.name}`, message })
    } catch {
      const copied = await copyToClipboard(message)
      toast.show(copied ? 'Chat summary copied' : 'Could not share chat', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  const callBack = useCallback(
    (message: ChatMessage) => {
      if (!canCall) return
      const type = message.content.split('|')[0] === 'video' ? 'video' : 'audio'
      void startOutgoingCall(chat, type)
    },
    [canCall, chat, startOutgoingCall],
  )

  // Auto-scroll to newest on load / own send / near-bottom; count unseen otherwise.
  useEffect(() => {
    const last = messages[messages.length - 1]
    const lastId = last?.id ?? null
    const prevId = lastMessageIdRef.current

    if (!lastId || lastId === prevId || pendingPrependRef.current) {
      lastMessageIdRef.current = lastId
      return
    }

    const isFirstLoad = prevId === null
    const isOwnLast = last?.senderId === currentUserId
    lastMessageIdRef.current = lastId

    if (isFirstLoad || isOwnLast || atBottomRef.current) {
      const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: !isFirstLoad }), 60)
      return () => clearTimeout(timer)
    }

    // New incoming message while scrolled up.
    setUnseen((n) => n + 1)
  }, [messages, currentUserId])

  useEffect(() => {
    if (!peerTyping) return
    if (atBottomRef.current) {
      const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60)
      return () => clearTimeout(timer)
    }
  }, [peerTyping])

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent
      scrollYRef.current = contentOffset.y
      viewportHeightRef.current = layoutMeasurement.height

      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height)
      const nearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD
      atBottomRef.current = nearBottom
      setShowScrollBtn(!nearBottom)
      if (nearBottom) setUnseen(0)

      if (
        contentOffset.y <= LOAD_OLDER_THRESHOLD &&
        hasMore &&
        !loadingOlder &&
        !pendingPrependRef.current
      ) {
        pendingPrependRef.current = true
        prevContentHeightRef.current = contentHeightRef.current
        void loadOlder()
      }
    },
    [hasMore, loadingOlder, loadOlder],
  )

  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    const previousHeight = contentHeightRef.current
    contentHeightRef.current = height

    if (pendingPrependRef.current) {
      // FlashList maintainVisibleContentPosition handles most prepend anchoring;
      // clear the pending flag once height settles.
      if (height !== previousHeight) pendingPrependRef.current = false
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true })
    atBottomRef.current = true
    setUnseen(0)
    setShowScrollBtn(false)
  }, [])

  function openActions(message: ChatMessage) {
    setActionsMessage(message)
    setActionsOpen(true)
  }

  async function handleMuteToggle() {
    const next = !isMuted
    setMutedOverride(next)
    setMenuOpen(false)
    await setConversationMuted(chat.id, currentUserId, next)
    onConversationChanged?.()
  }

  async function handleClearChat() {
    setMenuOpen(false)
    setInfoOpen(false)
    const now = new Date().toISOString()
    setClearedAt(now)
    await clearConversation(chat.id, currentUserId)
    onConversationChanged?.()
  }

  async function handleArchiveToggle() {
    setMenuOpen(false)
    const next = !chat.isArchived
    const { error } = await setConversationArchived(chat.id, currentUserId, next)
    if (error) {
      toast.show('Could not update archive', { tone: 'danger' })
      return
    }
    toast.show(next ? 'Chat archived' : 'Chat unarchived')
    onConversationChanged?.()
    if (next) {
      setInfoOpen(false)
      onBack()
    }
  }

  async function handleLeaveGroup() {
    setInfoOpen(false)
    setMenuOpen(false)
    const { error } = await removeGroupParticipant(chat.id, currentUserId)
    if (error) {
      toast.show('Could not exit group', { tone: 'danger', message: error })
      return
    }
    toast.show('You left the group')
    onConversationChanged?.()
    onBack()
  }

  const body = (
    <YStack flex={1} minHeight={0} backgroundColor={theme.threadBg}>
      {selectionMode ? (
        <XStack
          alignItems="center"
          gap={6}
          height={56}
          paddingHorizontal={8}
          backgroundColor={theme.headerBg}
          borderBottomWidth={1}
          borderBottomColor={theme.divider}
        >
          <HeaderIconButton onPress={exitSelection} label="Cancel selection">
            <Icons.X size={22} color={theme.text} />
          </HeaderIconButton>
          <Text flex={1} fontSize={17} fontWeight="700" color={theme.text}>
            {selectedIds.size}
          </Text>
          <HeaderIconButton onPress={bulkStar} label="Star selected">
            <Icons.Star size={20} color={theme.text} />
          </HeaderIconButton>
          <HeaderIconButton
            onPress={() => setForwardIds([...selectedIds])}
            label="Forward selected"
          >
            <Icons.Forward size={20} color={theme.text} />
          </HeaderIconButton>
          {selectedDeletableCount > 0 ? (
            <HeaderIconButton onPress={bulkDelete} label="Delete selected">
              <Icons.Trash2 size={20} color={theme.dangerText} />
            </HeaderIconButton>
          ) : null}
        </XStack>
      ) : searchOpen ? (
        <XStack
          alignItems="center"
          gap={6}
          height={56}
          paddingHorizontal={8}
          backgroundColor={theme.headerBg}
          borderBottomWidth={1}
          borderBottomColor={theme.divider}
        >
          <HeaderIconButton
            onPress={() => {
              setSearchOpen(false)
              setSearchQuery('')
            }}
            label="Close search"
          >
            <Icons.ArrowLeft size={22} color={theme.text} />
          </HeaderIconButton>
          <XStack
            flex={1}
            alignItems="center"
            height={40}
            paddingHorizontal={12}
            borderRadius={20}
            backgroundColor={theme.inputBg}
            borderWidth={1}
            borderColor={theme.border}
          >
            <Input
              flex={1}
              value={searchQuery}
              onChangeText={(v) => {
                setSearchQuery(v)
                setMatchIndex(0)
              }}
              placeholder="Search messages"
              placeholderTextColor={theme.textMuted}
              color={theme.text}
              backgroundColor="transparent"
              borderWidth={0}
              paddingHorizontal={0}
              height={38}
              fontSize={15}
              autoFocus
              focusStyle={{ borderWidth: 0, outlineWidth: 0, backgroundColor: 'transparent' }}
            />
          </XStack>
          <Text fontSize={12.5} color={theme.textMuted} minWidth={40} textAlign="center">
            {matchIds.length > 0 ? `${Math.min(matchIndex + 1, matchIds.length)}/${matchIds.length}` : '0/0'}
          </Text>
          <HeaderIconButton onPress={() => gotoMatch(-1)} label="Previous match">
            <Icons.ChevronUp size={22} color={matchIds.length ? theme.text : theme.textMuted} />
          </HeaderIconButton>
          <HeaderIconButton onPress={() => gotoMatch(1)} label="Next match">
            <Icons.ChevronDown size={22} color={matchIds.length ? theme.text : theme.textMuted} />
          </HeaderIconButton>
        </XStack>
      ) : (
        <ChatThreadHeader
          chat={{ ...chat, isMuted }}
          presence={presence}
          peerTyping={peerTyping}
          onSearch={() => setSearchOpen(true)}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenInfo={() => setInfoOpen(true)}
          onAudioCall={canCall ? () => void startOutgoingCall(chat, 'audio') : undefined}
          onVideoCall={canCall ? () => void startOutgoingCall(chat, 'video') : undefined}
        />
      )}

      {isLoading ? (
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" color={theme.brand} />
        </YStack>
      ) : (
        <YStack flex={1} minHeight={0} position="relative">
          <FlashList
            ref={scrollRef}
            data={visibleMessages}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={handleContentSizeChange}
            onLayout={(e) => {
              viewportHeightRef.current = e.nativeEvent.layout.height
            }}
            contentContainerStyle={{ paddingVertical: 12 }}
            style={{ flex: 1 }}
            drawDistance={280}
            ListHeaderComponent={
              loadingOlder ? (
                <YStack width="100%" alignItems="center" paddingVertical={10}>
                  <Spinner size="small" color={theme.brand} />
                </YStack>
              ) : null
            }
            ListEmptyComponent={
              <YStack flex={1} alignItems="center" justifyContent="center" gap={8} paddingVertical="$10">
                <Icons.MessageCircle size={38} color={theme.textMuted} />
                <Text fontSize={15} fontWeight="700" color={theme.text}>
                  No messages yet
                </Text>
                <Text fontSize={13} color={theme.textMuted}>
                  Say hi and start the conversation.
                </Text>
              </YStack>
            }
            ListFooterComponent={peerTyping ? <TypingBubble /> : null}
            renderItem={({ item: message, index }) => {
              const prev = visibleMessages[index - 1] ?? null
              const next = visibleMessages[index + 1] ?? null
              const dayBreak = isNewDay(prev?.createdAt ?? null, message.createdAt)
              const isOwn = message.senderId === currentUserId
              const showTail = dayBreak || !prev || prev.senderId !== message.senderId
              const readByPeer = !!peerReadAt && message.createdAt <= peerReadAt

              const isLastInRun =
                !next ||
                next.senderId !== message.senderId ||
                isNewDay(message.createdAt, next.createdAt)

              const showGroupSender = isGroup && !isOwn
              const sender = showGroupSender && message.senderId ? participants[message.senderId] : null

              return (
                <YStack>
                  {dayBreak ? <DateSeparator label={formatDaySeparator(message.createdAt)} /> : null}
                  <MessageBubble
                    message={message}
                    isOwn={isOwn}
                    showTail={showTail}
                    readByPeer={readByPeer}
                    reserveAvatarGutter={showGroupSender}
                    showAvatar={showGroupSender && isLastInRun}
                    senderName={showGroupSender && showTail ? sender?.name ?? 'Member' : null}
                    senderAvatarUrl={sender?.avatarUrl ?? null}
                    nameColor={
                      message.senderId ? getSenderColor(message.senderId, isDark) : undefined
                    }
                    reactions={reactionsByMessage[message.id]}
                    replySenderName={
                      message.replyPreview ? resolveSenderName(message.replyPreview.senderId) : null
                    }
                    onRequestActions={() => openActions(message)}
                    onReactionPress={(emoji) => react(message.id, emoji)}
                    onRetry={() => void resend(message)}
                    onOpenFile={() => void openFile(message)}
                    onCallBack={() => callBack(message)}
                    isStarred={starredIds.has(message.id)}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(message.id)}
                    onToggleSelect={() => toggleSelect(message.id)}
                    highlightTerm={searchOpen ? searchQuery.trim() : null}
                    pollResult={pollResultsByMessage[message.id]}
                    onVotePoll={(optionIndex) => void votePoll(message.id, optionIndex)}
                    currentUserId={currentUserId}
                  />
                </YStack>
              )
            }}
            extraData={{
              reactionsByMessage,
              starredIds,
              selectionMode,
              selectedIds,
              searchOpen,
              searchQuery,
              peerReadAt,
              pollResultsByMessage,
              participants,
              isDark,
            }}
          />

          {showScrollBtn ? (
            <YStack
              position="absolute"
              bottom={12}
              right={14}
              onPress={scrollToBottom}
              cursor="pointer"
              width={42}
              height={42}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor={theme.headerBg}
              borderWidth={1}
              borderColor={theme.border}
              shadowColor="#000"
              shadowOpacity={0.16}
              shadowRadius={8}
              shadowOffset={{ width: 0, height: 3 }}
              pressStyle={{ scale: 0.92 }}
              animation="quick"
              aria-label="Scroll to latest"
            >
              <Icons.ChevronDown size={22} color={theme.textSecondary} />
              {unseen > 0 ? (
                <XStack
                  position="absolute"
                  top={-6}
                  right={-6}
                  minWidth={20}
                  height={20}
                  paddingHorizontal={5}
                  borderRadius={999}
                  backgroundColor={theme.unreadBadge}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text fontSize={11} fontWeight="800" color={theme.unreadBadgeText}>
                    {unseen > 99 ? '99+' : unseen}
                  </Text>
                </XStack>
              ) : null}
            </YStack>
          ) : null}
        </YStack>
      )}

      {blocked ? (
        <XStack
          alignItems="center"
          justifyContent="center"
          gap={8}
          paddingVertical={14}
          paddingHorizontal={12}
          backgroundColor={theme.composerBg}
          borderTopWidth={1}
          borderTopColor={theme.border}
          onPress={handleBlockToggle}
          cursor="pointer"
        >
          <Icons.Ban size={16} color={theme.textMuted} />
          <Text fontSize={13.5} color={theme.textMuted}>
            You blocked this contact. Tap to unblock.
          </Text>
        </XStack>
      ) : (
        <MessageComposer
          conversationId={chat.id}
          onSend={(text) => {
            send(text, replyTarget)
            setReplyTarget(null)
          }}
          onSendImage={(attachment) => {
            sendImage(attachment, replyTarget)
            setReplyTarget(null)
          }}
          onSendFile={(attachment) => {
            sendFile(attachment, replyTarget)
            setReplyTarget(null)
          }}
          onSendAudio={(attachment) => {
            sendFile(attachment, replyTarget)
            setReplyTarget(null)
          }}
          onCreatePoll={() => setPollComposerOpen(true)}
          onCreateEvent={() => setEventPickerOpen(true)}
          onTyping={handleTyping}
          sending={sending}
          uploadProgress={uploadProgress}
          replyTo={replyTarget}
          replySenderName={replyTarget ? resolveSenderName(replyTarget.senderId) : null}
          onCancelReply={() => setReplyTarget(null)}
          editing={editingTarget}
          onEditSubmit={(messageId, text) => {
            void edit(messageId, text)
            setEditingTarget(null)
          }}
          onCancelEdit={() => setEditingTarget(null)}
        />
      )}

      <MessageActionsSheet
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        message={actionsMessage}
        isOwn={actionsMessage?.senderId === currentUserId}
        isStarred={actionsMessage ? starredIds.has(actionsMessage.id) : false}
        onReply={(message) => {
          setEditingTarget(null)
          setReplyTarget(message)
        }}
        onForward={(message) => setForwardIds([message.id])}
        onStar={(message) => toggleStar(message)}
        onSelect={(message) => enterSelection(message)}
        onEdit={(message) => {
          setReplyTarget(null)
          setEditingTarget(message)
        }}
        onDelete={(message) => void remove(message.id)}
        onReact={(messageId, emoji) => react(messageId, emoji)}
      />

      <ForwardSheet
        open={!!forwardIds}
        onOpenChange={(open) => {
          if (!open) setForwardIds(null)
        }}
        currentUserId={currentUserId}
        fromConversationId={chat.id}
        onPick={(target) => void handleForward(target)}
      />

      <StarredMessagesSheet
        open={starredOpen}
        onOpenChange={setStarredOpen}
        conversationId={chat.id}
        currentUserId={currentUserId}
        resolveSenderName={resolveSenderName}
      />

      <PollComposerSheet
        open={pollComposerOpen}
        onOpenChange={setPollComposerOpen}
        onSubmit={(poll) => void sendPoll(poll)}
      />

      <EventPickerSheet
        open={eventPickerOpen}
        onOpenChange={setEventPickerOpen}
        currentUserId={currentUserId}
        onPick={(event) => void sendEvent(event)}
      />

      <AppBottomSheet open={menuOpen} onOpenChange={setMenuOpen} scrollable={false}>
        <YStack>
          <XStack
            onPress={() => {
              setMenuOpen(false)
              setInfoOpen(true)
            }}
            cursor="pointer"
            alignItems="center"
            gap={14}
            paddingVertical={12}
            paddingHorizontal={6}
            borderRadius={10}
            hoverStyle={{ backgroundColor: theme.listItemHover }}
            pressStyle={{ backgroundColor: theme.listItemActive }}
            animation="quick"
          >
            <Icons.Info size={20} color={theme.textSecondary} />
            <Text fontSize={15.5} fontWeight="600" color={theme.text}>
              {isGroup ? 'Group info' : 'Contact info'}
            </Text>
          </XStack>

          <XStack
            onPress={() => {
              setMenuOpen(false)
              setStarredOpen(true)
            }}
            cursor="pointer"
            alignItems="center"
            gap={14}
            paddingVertical={12}
            paddingHorizontal={6}
            borderRadius={10}
            hoverStyle={{ backgroundColor: theme.listItemHover }}
            pressStyle={{ backgroundColor: theme.listItemActive }}
            animation="quick"
          >
            <Icons.Star size={20} color={theme.textSecondary} />
            <Text fontSize={15.5} fontWeight="600" color={theme.text}>
              Starred messages
            </Text>
          </XStack>

          <XStack
            onPress={() => void handleShareChatSummary()}
            cursor="pointer"
            alignItems="center"
            gap={14}
            paddingVertical={12}
            paddingHorizontal={6}
            borderRadius={10}
            hoverStyle={{ backgroundColor: theme.listItemHover }}
            pressStyle={{ backgroundColor: theme.listItemActive }}
            animation="quick"
          >
            <Icons.Share2 size={20} color={theme.textSecondary} />
            <Text fontSize={15.5} fontWeight="600" color={theme.text}>
              Share chat summary
            </Text>
          </XStack>

          <XStack
            onPress={handleMuteToggle}
            cursor="pointer"
            alignItems="center"
            gap={14}
            paddingVertical={12}
            paddingHorizontal={6}
            borderRadius={10}
            hoverStyle={{ backgroundColor: theme.listItemHover }}
            pressStyle={{ backgroundColor: theme.listItemActive }}
            animation="quick"
          >
            {isMuted ? (
              <Icons.Bell size={20} color={theme.textSecondary} />
            ) : (
              <Icons.BellOff size={20} color={theme.textSecondary} />
            )}
            <Text fontSize={15.5} fontWeight="600" color={theme.text}>
              {isMuted ? 'Unmute notifications' : 'Mute notifications'}
            </Text>
          </XStack>

          <XStack
            onPress={() => void handleArchiveToggle()}
            cursor="pointer"
            alignItems="center"
            gap={14}
            paddingVertical={12}
            paddingHorizontal={6}
            borderRadius={10}
            hoverStyle={{ backgroundColor: theme.listItemHover }}
            pressStyle={{ backgroundColor: theme.listItemActive }}
            animation="quick"
          >
            <Icons.Archive size={20} color={theme.textSecondary} />
            <Text fontSize={15.5} fontWeight="600" color={theme.text}>
              {chat.isArchived ? 'Unarchive chat' : 'Archive chat'}
            </Text>
          </XStack>

          <XStack
            onPress={() => {
              setMenuOpen(false)
              setDisappearOpen(true)
            }}
            cursor="pointer"
            alignItems="center"
            gap={14}
            paddingVertical={12}
            paddingHorizontal={6}
            borderRadius={10}
            hoverStyle={{ backgroundColor: theme.listItemHover }}
            pressStyle={{ backgroundColor: theme.listItemActive }}
            animation="quick"
          >
            <Icons.Timer size={20} color={theme.textSecondary} />
            <YStack flex={1}>
              <Text fontSize={15.5} fontWeight="600" color={theme.text}>
                Disappearing messages
              </Text>
              <Text fontSize={12.5} color={theme.textMuted}>
                {disappearingLabel(disappearingSeconds)}
              </Text>
            </YStack>
          </XStack>

          <XStack
            onPress={handleClearChat}
            cursor="pointer"
            alignItems="center"
            gap={14}
            paddingVertical={12}
            paddingHorizontal={6}
            borderRadius={10}
            hoverStyle={{ backgroundColor: theme.listItemHover }}
            pressStyle={{ backgroundColor: theme.listItemActive }}
            animation="quick"
          >
            <Icons.Eraser size={20} color={theme.dangerText} />
            <Text fontSize={15.5} fontWeight="600" color={theme.dangerText}>
              Clear chat
            </Text>
          </XStack>

          {chat.type === 'direct' && chat.otherUserId ? (
            <XStack
              onPress={handleBlockToggle}
              cursor="pointer"
              alignItems="center"
              gap={14}
              paddingVertical={12}
              paddingHorizontal={6}
              borderRadius={10}
              hoverStyle={{ backgroundColor: theme.listItemHover }}
              pressStyle={{ backgroundColor: theme.listItemActive }}
              animation="quick"
            >
              <Icons.Ban size={20} color={theme.dangerText} />
              <Text fontSize={15.5} fontWeight="600" color={theme.dangerText}>
                {blocked ? `Unblock ${chat.name}` : `Block ${chat.name}`}
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </AppBottomSheet>

      <ConversationInfoSheet
        open={infoOpen}
        onOpenChange={setInfoOpen}
        chat={{ ...chat, isMuted }}
        currentUserId={currentUserId}
        isMuted={isMuted}
        blocked={blocked}
        onToggleMute={() => void handleMuteToggle()}
        onToggleBlock={() => void handleBlockToggle()}
        onArchive={() => void handleArchiveToggle()}
        onClear={() => void handleClearChat()}
        onLeaveGroup={() => void handleLeaveGroup()}
        onChanged={onConversationChanged}
      />

      <AppBottomSheet
        open={disappearOpen}
        onOpenChange={setDisappearOpen}
        title="Disappearing messages"
        scrollable={false}
      >
        <YStack>
          {DISAPPEARING_OPTIONS.map((option) => {
            const active = disappearingSeconds === option.seconds
            return (
              <XStack
                key={option.label}
                onPress={() => void handleDisappearingPick(option.seconds)}
                cursor="pointer"
                alignItems="center"
                gap={14}
                paddingVertical={12}
                paddingHorizontal={6}
                borderRadius={10}
                hoverStyle={{ backgroundColor: theme.listItemHover }}
                pressStyle={{ backgroundColor: theme.listItemActive }}
                animation="quick"
              >
                <Icons.Timer size={20} color={active ? theme.brand : theme.textSecondary} />
                <Text
                  flex={1}
                  fontSize={15.5}
                  fontWeight="600"
                  color={active ? theme.brand : theme.text}
                >
                  {option.label}
                </Text>
                {active ? <Icons.Check size={20} color={theme.brand} /> : null}
              </XStack>
            )
          })}
        </YStack>
      </AppBottomSheet>

      {outgoing ? (
        <CallOverlay
          name={outgoing.peerName}
          avatarUrl={outgoing.peerAvatar}
          callType={outgoing.call.callType}
          variant="outgoing"
          statusText="Ringing…"
          onDecline={cancelOutgoingCall}
        />
      ) : null}
    </YStack>
  )

  if (Platform.OS === 'web') return body

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  )
}
