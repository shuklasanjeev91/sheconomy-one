import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, Platform, View } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { AppTextField } from '~/components/forms/AppTextField'
import {
  Avatar,
  Button,
  Icons,
  Input,
  KeyboardAvoidedByParentContext,
  ScrollView,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import {
  MeetingChatAttachmentView,
  MeetingChatAttachmentViewer,
} from '~/co-work/components/MeetingChatAttachmentView'
import { MEETING_CHAT_EMOJI_CATEGORIES, meetingChatEmojiOnlyCount } from '~/co-work/lib/meeting-chat-emoji'
import { MeetingSheetButton } from '~/co-work/components/MeetingSheetButton'
import { CoWorkPanelShell } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { useCoWorkTheme, useMeetingControlPalette } from '~/co-work/lib/theme'
import { useComposerKeyboardInset } from '~/hooks/useKeyboardVisible'
import type {
  MeetingChatAttachment,
  MeetingChatMessage,
  MeetingParticipant,
  MeetingParticipantChatWith,
  MeetingRole,
} from '~/co-work/lib/types'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'
import type { MeetingChatAudience } from '~/co-work/lib/meeting-role-permissions'
import {
  canDeleteMeetingChatMessage,
  isMeetingSystemChatMessage,
  meetingChatComposerAudiences,
  meetingChatMessageInSelectedChannel,
} from '~/co-work/lib/meeting-chat'
import {
  MEETING_CHAT_MAX_PHOTOS,
  meetingChatAttachmentCaption,
  type MeetingChatAttachmentPick,
} from '~/co-work/lib/meeting-chat-attachments'
import type { MeetingContentSource } from '~/co-work/lib/meeting-content-upload'
import {
  buildMeetingChatArchive,
  chatArchiveToPlainText,
  copyMeetingChatText,
  downloadMeetingChatText,
} from '~/co-work/lib/meeting-chat-archive'

/** Within this many px of the end still counts as reading the latest message. */
const CHAT_BOTTOM_SLOP = 80
/** Return key, send button and IME submit can all fire for one send. */
const DUPLICATE_SEND_WINDOW_MS = 1000

type MeetingChatPanelProps = {
  messages: MeetingChatMessage[]
  participants?: MeetingParticipant[]
  onSend: (text: string, audience?: MeetingChatAudience, recipientId?: string | null) => void
  onDelete?: (messageId: string) => void
  onClose: () => void
  fullWidth?: boolean
  currentUserId?: string
  viewerRole?: MeetingRole
  chatEnabled?: boolean
  privateChatEnabled?: boolean
  participantChatWith?: MeetingParticipantChatWith | null
  canManageChat?: boolean
  participantDisplayNames?: Record<string, string>
  /** Used for Zoom-style Save chat export filename. */
  meetingId?: string
  /** Uploads a picked file and posts it to the chosen chat audience. */
  onSendAttachment?: (
    source: MeetingContentSource,
    audience: MeetingChatAudience,
    recipientId: string | null,
  ) => Promise<void>
}

const ATTACH_OPTIONS: Array<{
  kind: MeetingChatAttachmentPick
  label: string
  icon: typeof Icons.Image
}> = [
  { kind: 'photo', label: 'Photo', icon: Icons.Image },
  { kind: 'video', label: 'Video', icon: Icons.Film },
  { kind: 'file', label: 'Document or file', icon: Icons.FileText },
]

export function MeetingChatPanel({
  messages,
  participants = [],
  onSend,
  onDelete,
  onClose,
  fullWidth,
  currentUserId,
  viewerRole = 'participant',
  chatEnabled = true,
  privateChatEnabled = false,
  participantChatWith = 'everyone',
  participantDisplayNames = {},
  meetingId,
  onSendAttachment,
}: MeetingChatPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const palette = useMeetingControlPalette()
  const toast = useAppToast()
  const keyboardInset = useComposerKeyboardInset()
  const [draft, setDraft] = useState('')
  const [audience, setAudience] = useState<MeetingChatAudience>('everyone')
  const [recipientId, setRecipientId] = useState<string | null>(null)
  const [recipientQuery, setRecipientQuery] = useState('')
  const [toMenuOpen, setToMenuOpen] = useState(false)
  const [attachMenuOpen, setAttachMenuOpen] = useState(false)
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [emojiCategory, setEmojiCategory] = useState(MEETING_CHAT_EMOJI_CATEGORIES[0]!.id)
  const [previewAttachment, setPreviewAttachment] = useState<MeetingChatAttachment | null>(null)
  const closePreview = useCallback(() => setPreviewAttachment(null), [])
  const lastSendRef = useRef<{ text: string; at: number } | null>(null)
  const lastPrivateRecipientRef = useRef<string | null>(null)
  const listRef = useRef<{ scrollToEnd?: (opts?: { animated?: boolean }) => void } | null>(null)

  const audiences = useMemo(
    () =>
      meetingChatComposerAudiences({
        viewerRole,
        privateEnabled: privateChatEnabled,
        participantChatWith,
      }),
    [participantChatWith, privateChatEnabled, viewerRole],
  )

  useEffect(() => {
    if (audiences.length === 0) return
    if (!audiences.includes(audience)) {
      setAudience(audiences[0]!)
      if (audiences[0] !== 'private') setRecipientId(null)
    }
  }, [audience, audiences])

  const privateTargets = useMemo(
    () =>
      participants.filter(
        (row) => row.status === 'admitted' && row.user_id !== currentUserId,
      ),
    [currentUserId, participants],
  )

  const filteredPrivateTargets = useMemo(() => {
    const q = recipientQuery.trim().toLowerCase()
    if (!q) return privateTargets
    return privateTargets.filter((row) => {
      const name = safeMeetingDisplayName(
        participantDisplayNames[row.user_id] ||
          row.display_name ||
          row.profile?.full_name ||
          row.profile?.username,
      ).toLowerCase()
      return name.includes(q)
    })
  }, [participantDisplayNames, privateTargets, recipientQuery])

  const toLabel = useMemo(() => {
    if (audience === 'everyone') return 'Everyone'
    if (audience === 'hosts') return 'Host'
    if (!recipientId) return 'Private…'
    const row = privateTargets.find((p) => p.user_id === recipientId)
    return safeMeetingDisplayName(
      participantDisplayNames[recipientId] ||
        row?.display_name ||
        row?.profile?.full_name ||
        row?.profile?.username ||
        'Participant',
    )
  }, [audience, participantDisplayNames, privateTargets, recipientId])

  useEffect(() => {
    if (!audiences.includes(audience)) setAudience('everyone')
  }, [audience, audiences])

  useEffect(() => {
    if (audience === 'private' && !recipientId && lastPrivateRecipientRef.current) {
      const stillThere = privateTargets.some((p) => p.user_id === lastPrivateRecipientRef.current)
      if (stillThere) setRecipientId(lastPrivateRecipientRef.current)
    }
  }, [audience, privateTargets, recipientId])

  const visibleMessages = useMemo(
    () =>
      (messages ?? []).filter((message) =>
        meetingChatMessageInSelectedChannel({
          message,
          audience,
          recipientId,
          currentUserId,
        }),
      ),
    [audience, currentUserId, messages, recipientId],
  )

  // Follow new messages only while the reader is at the bottom; otherwise count
  // them so scrolling back through history isn't yanked away.
  const stickToBottomRef = useRef(true)
  const seenCountRef = useRef(visibleMessages.length)
  const [unseenCount, setUnseenCount] = useState(0)

  const scrollToLatest = (animated: boolean) => {
    stickToBottomRef.current = true
    setUnseenCount(0)
    listRef.current?.scrollToEnd?.({ animated })
  }

  useEffect(() => {
    seenCountRef.current = visibleMessages.length
    scrollToLatest(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, recipientId])

  useEffect(() => {
    const added = visibleMessages.length - seenCountRef.current
    seenCountRef.current = visibleMessages.length
    if (added <= 0) return
    if (stickToBottomRef.current) {
      listRef.current?.scrollToEnd?.({ animated: true })
    } else {
      setUnseenCount((count) => count + added)
    }
  }, [visibleMessages.length])

  /** `submitted` is the keyboard's final text (iOS autocorrect can land after the last change event). */
  function send(submitted?: string) {
    const text = (submitted ?? draft).trim()
    if (!chatEnabled || !text) return
    if (audience === 'private' && !recipientId) return
    const now = Date.now()
    const last = lastSendRef.current
    if (last && last.text === text && now - last.at < DUPLICATE_SEND_WINDOW_MS) return
    lastSendRef.current = { text, at: now }
    if (audience === 'private' && recipientId) {
      lastPrivateRecipientRef.current = recipientId
    }
    onSend(text, audience, audience === 'private' ? recipientId : null)
    setDraft('')
  }

  function toggleEmojiPicker() {
    if (!chatEnabled) return
    setAttachMenuOpen(false)
    setToMenuOpen(false)
    if (!emojiOpen) Keyboard.dismiss()
    setEmojiOpen(!emojiOpen)
  }

  const emojiTab =
    MEETING_CHAT_EMOJI_CATEGORIES.find((category) => category.id === emojiCategory) ??
    MEETING_CHAT_EMOJI_CATEGORIES[0]!

  async function pickAndSendAttachment(kind: MeetingChatAttachmentPick) {
    setAttachMenuOpen(false)
    if (!onSendAttachment || !chatEnabled || uploadingLabel) return
    if (audience === 'private' && !recipientId) {
      toast.show('Choose a participant first', { tone: 'info' })
      return
    }
    const target = audience === 'private' ? recipientId : null

    let sources: MeetingContentSource[] = []
    try {
      const picker = await import('~/lib/media/pick-image')
      if (kind === 'photo') {
        sources = await picker.pickImages({ multiple: true, maxCount: MEETING_CHAT_MAX_PHOTOS })
      } else if (kind === 'video') {
        sources = await picker.pickVideos({ multiple: false })
      } else {
        const doc = await picker.pickDocument()
        sources = doc ? [doc] : []
      }
    } catch (cause) {
      toast.show('Could not open files', {
        tone: 'danger',
        message: cause instanceof Error ? cause.message : 'Try again.',
      })
      return
    }
    if (sources.length === 0) return

    let failed = 0
    let lastError: unknown = null
    for (const [index, source] of sources.entries()) {
      setUploadingLabel(
        sources.length > 1
          ? `Sending ${index + 1} of ${sources.length}…`
          : `Sending ${source.fileName || 'file'}…`,
      )
      try {
        await onSendAttachment(source, audience, target)
      } catch (cause) {
        failed += 1
        lastError = cause
      }
    }
    setUploadingLabel(null)
    if (failed > 0) {
      toast.show(failed === sources.length ? 'Could not send file' : `${failed} file(s) failed to send`, {
        tone: 'danger',
        message: lastError instanceof Error ? lastError.message : 'Upload failed. Try again.',
      })
    }
  }

  const [newChatTooltipDismissed, setNewChatTooltipDismissed] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  const composerPlaceholder = !chatEnabled
    ? 'Chat is disabled'
    : audience === 'hosts'
      ? 'Message hosts and co-hosts'
      : audience === 'private'
        ? recipientId
          ? `Message ${toLabel}`
          : 'Choose a participant'
        : 'Message Everyone'
  const sendDisabled = !chatEnabled || (audience === 'private' && !recipientId)

  async function handleSaveChat() {
    if (messages.length === 0) {
      toast.show('No messages to save', { tone: 'info' })
      return
    }
    const archive = buildMeetingChatArchive(
      meetingId || 'meeting',
      messages,
      participantDisplayNames,
    )
    const text = chatArchiveToPlainText(archive)
    if (!text.trim()) {
      toast.show('No messages to save', { tone: 'info' })
      return
    }
    const downloaded = downloadMeetingChatText({
      meetingId: meetingId || 'meeting',
      text,
    })
    if (downloaded) {
      toast.show('Chat saved', { tone: 'success', message: 'Downloaded as a text file.' })
      return
    }
    const copied = await copyMeetingChatText(text)
    toast.show(copied ? 'Chat copied' : 'Could not save chat', {
      tone: copied ? 'success' : 'danger',
      message: copied ? 'Paste into Notes, email, or any editor.' : undefined,
    })
  }

  return (
    <KeyboardAvoidedByParentContext.Provider value>
    <CoWorkPanelShell fullWidth={fullWidth}>
      {/* Zoom Mobile Header & Channel Selector (Image 1) */}
      {fullWidth ? (
        <YStack width="100%" backgroundColor={coworkUi.meetingBarElevated}>
          {/* Top handle bar */}
          <YStack
            width={36}
            height={4}
            borderRadius={2}
            backgroundColor={coworkUi.border}
            alignSelf="center"
            marginTop={8}
            marginBottom={4}
          />

          {/* Header Row: Circular (X) · [Everyone ^] · Circular (...) */}
          <XStack
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$3.5"
            paddingVertical="$2"
            borderBottomWidth={1}
            borderBottomColor={coworkUi.borderSoft}
          >
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close chat"
              hitSlop={8}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? palette.bgPressed : palette.bgStrong,
              })}
            >
              <Icons.X size={18} color={palette.fg} />
            </Pressable>

            <Pressable
              onPress={() => setToMenuOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${toLabel}, tap to change`}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: pressed ? palette.bgPressed : 'transparent',
              })}
            >
              <Text fontSize={17} fontWeight="800" color={coworkUi.text} letterSpacing={-0.3}>
                {toLabel}
              </Text>
              {toMenuOpen ? (
                <Icons.ChevronUp size={16} color={palette.fgMuted} />
              ) : (
                <Icons.ChevronDown size={16} color={palette.fgMuted} />
              )}
            </Pressable>

            <Pressable
              onPress={() => setMoreMenuOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel="Chat options"
              hitSlop={8}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? coworkUi.brandDark : coworkUi.brand,
              })}
            >
              <Icons.MoreHorizontal size={18} color="#fff" />
            </Pressable>
          </XStack>

          {/* More options menu dropdown if open */}
          {moreMenuOpen ? (
            <YStack
              marginHorizontal="$3.5"
              marginTop="$2"
              padding="$2"
              borderRadius={12}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
              backgroundColor={coworkUi.meetingBarElevated}
              gap={2}
            >
              <Pressable
                onPress={() => {
                  setMoreMenuOpen(false)
                  void handleSaveChat()
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: pressed ? coworkUi.brandMuted : 'transparent',
                })}
              >
                <Icons.Download size={16} color={coworkUi.brandLight} />
                <Text color={coworkUi.text} fontSize={13} fontWeight="600">
                  Save chat
                </Text>
              </Pressable>
            </YStack>
          ) : null}

          {/* Channel / Direct Message Switcher Row with Popover Tooltip (Image 1) */}
          <XStack
            alignItems="center"
            gap="$2.5"
            paddingHorizontal="$3.5"
            paddingTop="$2.5"
            paddingBottom="$2.5"
            position="relative"
            zIndex={25}
          >
            {/* Everyone Channel Tab */}
            <Pressable
              onPress={() => {
                setAudience('everyone')
                setRecipientId(null)
              }}
              accessibilityRole="button"
              accessibilityLabel="Everyone channel"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: audience === 'everyone' ? coworkUi.brandMuted : palette.bgStrong,
                borderWidth: audience === 'everyone' ? 2 : 1,
                borderColor: audience === 'everyone' ? coworkUi.brand : coworkUi.borderSoft,
              }}
            >
              <Icons.Users size={20} color={audience === 'everyone' ? coworkUi.brandLight : palette.fg} />
            </Pressable>

            {/* Active Direct Message / Host Tab */}
            {audience !== 'everyone' ? (
              <Pressable
                onPress={() => setToMenuOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel={`Active chat with ${toLabel}`}
                style={{
                  height: 44,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: coworkUi.brandMuted,
                  borderWidth: 2,
                  borderColor: coworkUi.brand,
                }}
              >
                <Icons.User size={16} color={coworkUi.brandLight} />
                <Text fontSize={13} fontWeight="700" color={coworkUi.text} numberOfLines={1} maxWidth={110}>
                  {toLabel}
                </Text>
              </Pressable>
            ) : null}

            {/* Plus button to start new chat */}
            <Pressable
              onPress={() => {
                setToMenuOpen((open) => !open)
                setNewChatTooltipDismissed(true)
              }}
              accessibilityRole="button"
              accessibilityLabel="Start new chat"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: palette.bgStrong,
                borderWidth: 1,
                borderColor: palette.border,
              }}
            >
              <Icons.Plus size={20} color={palette.fg} />
            </Pressable>

            {/* Anchored Tooltip Bubble: [NEW] New chat (Image 1) */}
            {!newChatTooltipDismissed && !toMenuOpen && visibleMessages.length === 0 ? (
              <YStack
                position="absolute"
                top={50}
                left={14}
                right={14}
                zIndex={30}
                style={{
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
                }}
              >
                {/* Upward pointer triangle pointing to [+] */}
                <YStack
                  style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: 8,
                    borderRightWidth: 8,
                    borderBottomWidth: 8,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderBottomColor: '#22252A',
                    marginLeft: 66,
                  }}
                />
                <Pressable
                  onPress={() => {
                    setToMenuOpen(true)
                    setNewChatTooltipDismissed(true)
                  }}
                >
                  <YStack
                    backgroundColor="#22252A"
                    borderRadius={14}
                    paddingHorizontal="$3.5"
                    paddingVertical="$3"
                    borderWidth={1}
                    borderColor="rgba(255, 255, 255, 0.18)"
                    gap="$1.5"
                  >
                    <XStack alignItems="center" gap="$2">
                      <YStack
                        paddingHorizontal={6}
                        paddingVertical={2}
                        borderRadius={5}
                        backgroundColor="#2563EB"
                      >
                        <Text color="#fff" fontSize={11} fontWeight="800" letterSpacing={0.4}>
                          NEW
                        </Text>
                      </YStack>
                      <Text color="#fff" fontSize={16} fontWeight="800">
                        New chat
                      </Text>
                    </XStack>
                    <Text color="#D1D5DB" fontSize={13} lineHeight={18}>
                      Direct message someone or start group chats with two or more participants.
                    </Text>
                  </YStack>
                </Pressable>
              </YStack>
            ) : null}
          </XStack>
        </YStack>
      ) : (
        <MeetingPanelHeader
          title="Everyone"
          subtitle={
            chatEnabled
              ? `${messages.length} message${messages.length === 1 ? '' : 's'} · This meeting only`
              : 'Chat is turned off for this meeting'
          }
          icon={<Icons.MessageSquare size={18} color={coworkUi.brandLight} />}
          onClose={onClose}
          trailing={
            messages.length > 0 ? (
              Platform.OS === 'web' ? (
                <Button
                  tone="ghost"
                  size="$2"
                  borderRadius={999}
                  width={36}
                  height={36}
                  padding={0}
                  onPress={() => void handleSaveChat()}
                  icon={<Icons.Download size={16} color={coworkUi.textSecondary} />}
                  accessibilityLabel="Save chat"
                />
              ) : (
                <MeetingSheetButton
                  accessibilityLabel="Save chat"
                  onPress={() => void handleSaveChat()}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    backgroundColor: palette.bgStrong,
                  }}
                >
                  <Icons.Download size={16} color={coworkUi.textSecondary} />
                </MeetingSheetButton>
              )
            ) : null
          }
        />
      )}

      <YStack flex={1} minHeight={0} position="relative">
      <ScrollView
        flex={1}
        minHeight={0}
        padding="$3"
        ref={listRef as never}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        scrollEventThrottle={32}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
          const atBottom =
            contentSize.height - (contentOffset.y + layoutMeasurement.height) < CHAT_BOTTOM_SLOP
          stickToBottomRef.current = atBottom
          if (atBottom) setUnseenCount(0)
        }}
        onContentSizeChange={() => {
          if (stickToBottomRef.current) listRef.current?.scrollToEnd?.({ animated: false })
        }}
      >
        <YStack gap="$3">
          {!chatEnabled ? (
            <YStack
              padding="$5"
              alignItems="center"
              gap="$3"
              borderRadius={coworkUi.radius.panel}
              backgroundColor={coworkUi.surfaceMuted}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
            >
              <Icons.MessageSquare size={28} color={coworkUi.textMuted} />
              <Text color={coworkUi.textMuted} textAlign="center" fontSize={13} lineHeight={19}>
                The host disabled in-meeting chat.
              </Text>
            </YStack>
          ) : null}
          {chatEnabled && visibleMessages.length === 0 ? (
            <YStack
              padding="$5"
              alignItems="center"
              gap="$3"
              borderRadius={coworkUi.radius.panel}
              backgroundColor={coworkUi.surfaceMuted}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
            >
              <Icons.MessageSquare size={28} color={coworkUi.textMuted} />
              <Text color={coworkUi.textMuted} textAlign="center" fontSize={13} lineHeight={19}>
                {audience === 'private' && !recipientId
                  ? 'Choose a participant to start a private chat.'
                  : audience === 'private'
                    ? `No private messages with ${toLabel} yet.`
                    : audience === 'hosts'
                      ? 'No host messages yet. Only the host and co-hosts see this chat.'
                      : 'No messages yet. Messages here are visible to everyone in the meeting.'}
              </Text>
            </YStack>
          ) : null}
          {visibleMessages.map((msg) => {
            if (isMeetingSystemChatMessage(msg)) {
              return (
                <XStack key={msg.id} justifyContent="center" paddingVertical={2}>
                  <Text
                    fontSize={12}
                    fontWeight="600"
                    color={coworkUi.textMuted}
                    textAlign="center"
                    maxWidth="90%"
                  >
                    {msg.message_text}
                  </Text>
                </XStack>
              )
            }

            const isSelf = currentUserId ? msg.sender_id === currentUserId : false
            const senderName = safeMeetingDisplayName(
              participantDisplayNames[msg.sender_id] ||
                msg.sender?.full_name ||
                msg.sender?.username,
            )
            const hostsOnly = msg.audience === 'hosts'
            const isPrivate = msg.audience === 'private'
            const privatePeerId = isSelf ? msg.recipient_id : msg.sender_id
            const privatePeerName = privatePeerId
              ? safeMeetingDisplayName(participantDisplayNames[privatePeerId], 'Participant')
              : 'Participant'
            const canDelete =
              !!currentUserId &&
              canDeleteMeetingChatMessage({
                viewerRole,
                message: msg,
                currentUserId,
              })
            const caption = meetingChatAttachmentCaption(msg)
            const bigEmoji = msg.attachment ? 0 : meetingChatEmojiOnlyCount(caption)
            const plain = bigEmoji > 0 && !hostsOnly && !isPrivate

            return (
              <XStack
                key={msg.id}
                gap="$2"
                alignItems="flex-end"
                justifyContent={isSelf ? 'flex-end' : 'flex-start'}
              >
                {!isSelf ? (
                  <Avatar
                    name={senderName}
                    src={msg.sender?.avatar_url ?? undefined}
                    size="$3"
                  />
                ) : null}
                <YStack
                  maxWidth="82%"
                  paddingHorizontal={plain ? '$1' : '$3'}
                  paddingVertical={plain ? 0 : '$2'}
                  borderRadius={18}
                  borderBottomRightRadius={isSelf ? 6 : 18}
                  borderBottomLeftRadius={isSelf ? 18 : 6}
                  backgroundColor={
                    plain ? 'transparent' : isSelf ? coworkUi.chatBubbleSelf : coworkUi.chatBubbleOther
                  }
                  borderWidth={plain ? 0 : 1}
                  borderColor={isSelf ? coworkUi.borderAccent : coworkUi.borderSoft}
                  gap={4}
                >
                  <XStack alignItems="center" justifyContent="space-between" gap="$2">
                    {!isSelf ? (
                      <Text fontSize={11} fontWeight="700" color={coworkUi.brandLight}>
                        {senderName}
                      </Text>
                    ) : (
                      <YStack flex={1} />
                    )}
                    {canDelete && onDelete ? (
                      <Button
                        tone="ghost"
                        size="$1"
                        paddingHorizontal={6}
                        height={22}
                        onPress={() => onDelete(msg.id)}
                        accessibilityLabel="Delete message"
                      >
                        <Icons.Trash2 size={12} color={coworkUi.textMuted} />
                      </Button>
                    ) : null}
                  </XStack>
                  {hostsOnly ? (
                    <Text fontSize={10} fontWeight="700" color={coworkUi.warning}>
                      Host
                    </Text>
                  ) : null}
                  {isPrivate ? (
                    <Text fontSize={10} fontWeight="700" color={coworkUi.brandLight}>
                      {isSelf ? `Private to ${privatePeerName}` : 'Private message'}
                    </Text>
                  ) : null}
                  {msg.attachment ? (
                    <MeetingChatAttachmentView attachment={msg.attachment} onPreview={setPreviewAttachment} />
                  ) : null}
                  {caption ? (
                    <Text
                      fontSize={bigEmoji === 1 ? 44 : bigEmoji > 1 ? 34 : 14}
                      color={coworkUi.text}
                      lineHeight={bigEmoji === 1 ? 52 : bigEmoji > 1 ? 42 : 20}
                      textAlign={plain && isSelf ? 'right' : 'left'}
                    >
                      {caption}
                    </Text>
                  ) : null}
                </YStack>
              </XStack>
            )
          })}
        </YStack>
      </ScrollView>
      {unseenCount > 0 ? (
        <XStack position="absolute" bottom={10} left={0} right={0} justifyContent="center" zIndex={5}>
          <Pressable
            onPress={() => scrollToLatest(true)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${unseenCount} new message${unseenCount === 1 ? '' : 's'}`}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: pressed ? coworkUi.brandDark : coworkUi.brand,
            })}
          >
            <Icons.ChevronDown size={14} color="#fff" />
            <Text color="#fff" fontSize={12} fontWeight="800">
              {unseenCount} new message{unseenCount === 1 ? '' : 's'}
            </Text>
          </Pressable>
        </XStack>
      ) : null}
      </YStack>

      <YStack
        flexShrink={0}
        paddingHorizontal="$3"
        paddingTop="$2.5"
        gap="$2"
        borderTopWidth={1}
        borderTopColor={coworkUi.borderSoft}
        backgroundColor={coworkUi.surfaceElevated}
        pointerEvents="auto"
        zIndex={6}
        paddingBottom={
          fullWidth
            ? Platform.OS === 'android'
              ? 10
              : 8
            : Math.max(12, keyboardInset)
        }
      >
        {chatEnabled && audiences.length > 1 ? (
          <YStack gap="$2">
            {fullWidth ? null : (
              <XStack alignItems="center" gap="$2">
                <Text fontSize={12} fontWeight="700" color={coworkUi.meetingIconMuted}>
                  To:
                </Text>
                {Platform.OS === 'web' ? (
                  <Button
                    tone="outline"
                    size="$2"
                    borderRadius={12}
                    flex={1}
                    justifyContent="space-between"
                    borderColor={coworkUi.glassBorder}
                    backgroundColor={coworkUi.meetingControl}
                    iconAfter={<Icons.ChevronDown size={14} color={coworkUi.textMuted} />}
                    onPress={() => setToMenuOpen((open) => !open)}
                  >
                    {toLabel}
                  </Button>
                ) : (
                  <MeetingSheetButton
                    accessibilityLabel={`Chat audience, ${toLabel}`}
                    onPress={() => setToMenuOpen((open) => !open)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: coworkUi.meetingControl,
                      borderWidth: 1,
                      borderColor: coworkUi.glassBorder,
                    }}
                  >
                    <Text fontSize={13} fontWeight="700" color={coworkUi.text}>
                      {toLabel}
                    </Text>
                    <Icons.ChevronDown size={14} color={coworkUi.textMuted} />
                  </MeetingSheetButton>
                )}
              </XStack>
            )}
            {toMenuOpen ? (
              <YStack
                gap={2}
                padding="$2"
                borderRadius={12}
                borderWidth={1}
                borderColor={coworkUi.glassBorder}
                backgroundColor={coworkUi.meetingBarElevated}
              >
                {audiences.includes('everyone') ? (
                  Platform.OS === 'web' ? (
                    <Button
                      tone={audience === 'everyone' ? 'primary' : 'ghost'}
                      size="$2"
                      borderRadius={10}
                      justifyContent="flex-start"
                      onPress={() => {
                        setAudience('everyone')
                        setToMenuOpen(false)
                      }}
                    >
                      Everyone
                    </Button>
                  ) : (
                    <MeetingSheetButton
                      accessibilityLabel="Message everyone"
                      onPress={() => {
                        setAudience('everyone')
                        setToMenuOpen(false)
                      }}
                      style={{
                        minHeight: 40,
                        borderRadius: 10,
                        justifyContent: 'flex-start',
                        paddingHorizontal: 12,
                        backgroundColor:
                          audience === 'everyone' ? coworkUi.brand : 'transparent',
                      }}
                    >
                      <Text
                        fontSize={13}
                        fontWeight="700"
                        color={audience === 'everyone' ? '#fff' : coworkUi.text}
                      >
                        Everyone
                      </Text>
                    </MeetingSheetButton>
                  )
                ) : null}
                {audiences.includes('hosts') ? (
                  Platform.OS === 'web' ? (
                    <Button
                      tone={audience === 'hosts' ? 'primary' : 'ghost'}
                      size="$2"
                      borderRadius={10}
                      justifyContent="flex-start"
                      onPress={() => {
                        setAudience('hosts')
                        setToMenuOpen(false)
                      }}
                    >
                      Host
                    </Button>
                  ) : (
                    <MeetingSheetButton
                      accessibilityLabel="Message hosts only"
                      onPress={() => {
                        setAudience('hosts')
                        setToMenuOpen(false)
                      }}
                      style={{
                        minHeight: 40,
                        borderRadius: 10,
                        justifyContent: 'flex-start',
                        paddingHorizontal: 12,
                        backgroundColor: audience === 'hosts' ? coworkUi.brand : 'transparent',
                      }}
                    >
                      <Text
                        fontSize={13}
                        fontWeight="700"
                        color={audience === 'hosts' ? '#fff' : coworkUi.text}
                      >
                        Host
                      </Text>
                    </MeetingSheetButton>
                  )
                ) : null}
                {audiences.includes('private') ? (
                  <>
                    <Text
                      fontSize={11}
                      fontWeight="700"
                      color={coworkUi.meetingIconMuted}
                      paddingHorizontal="$2"
                      paddingTop="$1"
                    >
                      Private message
                    </Text>
                    <Input
                      value={recipientQuery}
                      onChangeText={setRecipientQuery}
                      placeholder="Search participants"
                      backgroundColor={coworkUi.meetingControl}
                      borderColor={coworkUi.borderSoft}
                      color={coworkUi.text}
                      placeholderTextColor={coworkUi.textMuted}
                      borderRadius={10}
                      height={36}
                    />
                    {filteredPrivateTargets.length === 0 ? (
                      <Text fontSize={12} color={coworkUi.textMuted} padding="$2">
                        No matching participants.
                      </Text>
                    ) : (
                      <ScrollView
                        maxHeight={180}
                        showsVerticalScrollIndicator
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                      >
                        <YStack gap={2}>
                          {filteredPrivateTargets.map((row) => {
                            const name = safeMeetingDisplayName(
                              participantDisplayNames[row.user_id] ||
                                row.display_name ||
                                row.profile?.full_name ||
                                row.profile?.username,
                            )
                            return Platform.OS === 'web' ? (
                              <Button
                                key={row.user_id}
                                tone={recipientId === row.user_id ? 'primary' : 'ghost'}
                                size="$2"
                                borderRadius={10}
                                justifyContent="flex-start"
                                onPress={() => {
                                  setAudience('private')
                                  setRecipientId(row.user_id)
                                  lastPrivateRecipientRef.current = row.user_id
                                  setToMenuOpen(false)
                                  setRecipientQuery('')
                                }}
                              >
                                {name}
                              </Button>
                            ) : (
                              <MeetingSheetButton
                                key={row.user_id}
                                accessibilityLabel={`Private message ${name}`}
                                onPress={() => {
                                  setAudience('private')
                                  setRecipientId(row.user_id)
                                  lastPrivateRecipientRef.current = row.user_id
                                  setToMenuOpen(false)
                                  setRecipientQuery('')
                                }}
                                style={{
                                  minHeight: 40,
                                  borderRadius: 10,
                                  justifyContent: 'flex-start',
                                  paddingHorizontal: 12,
                                  backgroundColor:
                                    recipientId === row.user_id ? coworkUi.brand : 'transparent',
                                }}
                              >
                                <Text
                                  fontSize={13}
                                  fontWeight="700"
                                  color={recipientId === row.user_id ? '#fff' : coworkUi.text}
                                >
                                  {name}
                                </Text>
                              </MeetingSheetButton>
                            )
                          })}
                        </YStack>
                      </ScrollView>
                    )}
                  </>
                ) : null}
              </YStack>
            ) : null}
          </YStack>
        ) : null}
        {attachMenuOpen && !uploadingLabel ? (
          <YStack
            gap={2}
            padding="$2"
            borderRadius={12}
            borderWidth={1}
            borderColor={coworkUi.glassBorder}
            backgroundColor={coworkUi.meetingBarElevated}
          >
            {ATTACH_OPTIONS.map(({ kind, label, icon: OptionIcon }) =>
              Platform.OS === 'web' ? (
                <Button
                  key={kind}
                  tone="ghost"
                  size="$2"
                  borderRadius={10}
                  justifyContent="flex-start"
                  icon={<OptionIcon size={16} color={coworkUi.text} />}
                  onPress={() => void pickAndSendAttachment(kind)}
                >
                  {label}
                </Button>
              ) : (
                <MeetingSheetButton
                  key={kind}
                  accessibilityLabel={`Send ${label.toLowerCase()}`}
                  onPress={() => void pickAndSendAttachment(kind)}
                  style={{
                    minHeight: 40,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 10,
                    paddingHorizontal: 12,
                  }}
                >
                  <OptionIcon size={16} color={coworkUi.text} />
                  <Text fontSize={13} fontWeight="700" color={coworkUi.text}>
                    {label}
                  </Text>
                </MeetingSheetButton>
              ),
            )}
          </YStack>
        ) : null}
        {uploadingLabel ? (
          <XStack alignItems="center" gap="$2" paddingHorizontal="$1">
            <Icons.Paperclip size={14} color={coworkUi.textMuted} />
            <Text fontSize={12} fontWeight="600" color={coworkUi.textMuted} numberOfLines={1} flex={1}>
              {uploadingLabel}
            </Text>
          </XStack>
        ) : null}
        {emojiOpen && chatEnabled ? (
          <YStack
            height={236}
            borderRadius={12}
            borderWidth={1}
            borderColor={coworkUi.glassBorder}
            backgroundColor={coworkUi.meetingBarElevated}
            overflow="hidden"
          >
            <XStack
              paddingHorizontal={4}
              paddingVertical={4}
              gap={2}
              borderBottomWidth={1}
              borderBottomColor={coworkUi.borderSoft}
              justifyContent="space-between"
            >
              {MEETING_CHAT_EMOJI_CATEGORIES.map((category) => {
                const selected = category.id === emojiTab.id
                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="tab"
                    accessibilityLabel={category.label}
                    accessibilityState={{ selected }}
                    onPress={() => setEmojiCategory(category.id)}
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? coworkUi.brandMuted : 'transparent',
                    }}
                  >
                    <Text fontSize={18}>{category.icon}</Text>
                  </Pressable>
                )
              })}
            </XStack>
            <ScrollView flex={1} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator>
              <Text
                fontSize={11}
                fontWeight="700"
                color={coworkUi.textMuted}
                paddingHorizontal="$2.5"
                paddingTop="$2"
              >
                {emojiTab.label}
              </Text>
              <XStack flexWrap="wrap" paddingHorizontal={4} paddingBottom={6}>
                {emojiTab.emojis.map((emoji) => (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`Insert ${emoji}`}
                    onPress={() => setDraft((value) => `${value}${emoji}`)}
                    style={({ pressed }) => ({
                      width: '12.5%',
                      height: 42,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: pressed ? coworkUi.brandMuted : 'transparent',
                    })}
                  >
                    <Text fontSize={26}>{emoji}</Text>
                  </Pressable>
                ))}
              </XStack>
            </ScrollView>
          </YStack>
        ) : null}
        {/* Zoom composer: attachment · input · emoji · send — always contrast-safe. */}
        <View
          collapsable={false}
          pointerEvents="auto"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            minHeight: 48,
            zIndex: 8,
            elevation: 12,
          }}
        >
          {onSendAttachment ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send a photo, video or file"
              accessibilityState={{ expanded: attachMenuOpen, busy: !!uploadingLabel }}
              disabled={!chatEnabled || !!uploadingLabel}
              onPress={() => {
                setToMenuOpen(false)
                setEmojiOpen(false)
                setAttachMenuOpen((value) => !value)
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: attachMenuOpen ? coworkUi.brand : coworkUi.meetingControl,
                borderWidth: 1,
                borderColor: coworkUi.glassBorder,
                opacity: chatEnabled && !uploadingLabel ? 1 : 0.45,
              }}
            >
              <Icons.Plus size={20} color={attachMenuOpen ? '#fff' : coworkUi.text} />
            </Pressable>
          ) : null}
          {Platform.OS === 'web' ? (
            <Input
              flex={1}
              value={draft}
              onChangeText={setDraft}
              editable={chatEnabled}
              placeholder={composerPlaceholder}
              backgroundColor={coworkUi.meetingControl}
              borderColor={coworkUi.glassBorder}
              color={coworkUi.text}
              placeholderTextColor={coworkUi.textMuted}
              borderRadius={22}
              height={42}
              onFocus={() => setEmojiOpen(false)}
              onSubmitEditing={() => send()}
            />
          ) : (
            <AppTextField
              embedded
              value={draft}
              onChangeText={setDraft}
              editable={chatEnabled}
              placeholder={composerPlaceholder}
              placeholderTextColor={coworkUi.textMuted}
              color={coworkUi.text}
              returnKeyType="send"
              enterKeyHint="send"
              autoCorrect
              autoCapitalize="sentences"
              accessibilityLabel="Meeting chat message"
              submitBehavior="submit"
              onFocus={() => setEmojiOpen(false)}
              onSubmitEditing={(event) => send(event.nativeEvent.text)}
              containerStyle={{
                flex: 1,
                minWidth: 0,
                height: 42,
                minHeight: 42,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: coworkUi.glassBorder,
                backgroundColor: coworkUi.meetingControl,
                paddingHorizontal: 14,
              }}
            />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={emojiOpen ? 'Close emoji picker' : 'Open emoji picker'}
            accessibilityState={{ expanded: emojiOpen }}
            disabled={!chatEnabled}
            onPress={toggleEmojiPicker}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: emojiOpen ? coworkUi.brand : coworkUi.meetingControl,
              borderWidth: 1,
              borderColor: emojiOpen ? coworkUi.brand : coworkUi.glassBorder,
              opacity: chatEnabled ? 1 : 0.45,
            }}
          >
            <Icons.Smile size={20} color={emojiOpen ? '#fff' : coworkUi.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send chat message"
            disabled={sendDisabled || !draft.trim()}
            onPress={() => send()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                sendDisabled || !draft.trim() ? coworkUi.meetingControl : coworkUi.brand,
              borderWidth: 1,
              borderColor:
                sendDisabled || !draft.trim() ? coworkUi.glassBorder : coworkUi.brand,
              opacity: sendDisabled || !draft.trim() ? 0.55 : 1,
            }}
          >
            <Icons.Send
              size={18}
              color={sendDisabled || !draft.trim() ? coworkUi.textMuted : '#fff'}
            />
          </Pressable>
        </View>
      </YStack>
      {previewAttachment ? (
        <MeetingChatAttachmentViewer attachment={previewAttachment} onClose={closePreview} />
      ) : null}
    </CoWorkPanelShell>
    </KeyboardAvoidedByParentContext.Provider>
  )
}
