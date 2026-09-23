import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, View } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { AppTextField } from '~/components/forms/AppTextField'
import { Avatar, Button, Icons, Input, ScrollView, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { MeetingSheetButton } from '~/co-work/components/MeetingSheetButton'
import { CoWorkPanelShell } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { useComposerKeyboardInset } from '~/hooks/useKeyboardVisible'
import type {
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
} from '~/co-work/lib/meeting-chat'
import {
  buildMeetingChatArchive,
  chatArchiveToPlainText,
  copyMeetingChatText,
  downloadMeetingChatText,
} from '~/co-work/lib/meeting-chat-archive'

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
  /** Opens Zoom-style share content / attachment picker. */
  onAttach?: () => void
}

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
  canManageChat = false,
  participantDisplayNames = {},
  meetingId,
  onAttach,
}: MeetingChatPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const keyboardInset = useComposerKeyboardInset()
  const [draft, setDraft] = useState('')
  const [audience, setAudience] = useState<MeetingChatAudience>('everyone')
  const [recipientId, setRecipientId] = useState<string | null>(null)
  const [recipientQuery, setRecipientQuery] = useState('')
  const [toMenuOpen, setToMenuOpen] = useState(false)
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
    if (audience === 'hosts') return 'Hosts'
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

  useEffect(() => {
    listRef.current?.scrollToEnd?.({ animated: true })
  }, [messages.length])

  function send() {
    if (!chatEnabled || !draft.trim()) return
    if (audience === 'private' && !recipientId) return
    if (audience === 'private' && recipientId) {
      lastPrivateRecipientRef.current = recipientId
    }
    onSend(draft.trim(), audience, audience === 'private' ? recipientId : null)
    setDraft('')
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
    <CoWorkPanelShell fullWidth={fullWidth}>
      {/* Zoom Mobile Header & Channel Selector (Image 1) */}
      {fullWidth ? (
        <YStack width="100%" backgroundColor={coworkUi.meetingBarElevated}>
          {/* Top handle bar */}
          <YStack
            width={36}
            height={4}
            borderRadius={2}
            backgroundColor="rgba(255, 255, 255, 0.28)"
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
            borderBottomColor="rgba(255, 255, 255, 0.08)"
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
                backgroundColor: pressed ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.12)',
              })}
            >
              <Icons.X size={18} color="#fff" />
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
                backgroundColor: pressed ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
              })}
            >
              <Text fontSize={17} fontWeight="800" color="#fff" letterSpacing={-0.3}>
                {toLabel}
              </Text>
              {toMenuOpen ? (
                <Icons.ChevronUp size={16} color="rgba(255, 255, 255, 0.85)" />
              ) : (
                <Icons.ChevronDown size={16} color="rgba(255, 255, 255, 0.85)" />
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
                backgroundColor: audience === 'everyone' ? coworkUi.brandMuted : 'rgba(255, 255, 255, 0.08)',
                borderWidth: audience === 'everyone' ? 2 : 1,
                borderColor: audience === 'everyone' ? coworkUi.brand : coworkUi.borderSoft,
              }}
            >
              <Icons.Users size={20} color={audience === 'everyone' ? coworkUi.brandLight : '#fff'} />
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
                <Text fontSize={13} fontWeight="700" color="#fff" numberOfLines={1} maxWidth={110}>
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
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.18)',
              }}
            >
              <Icons.Plus size={20} color="#fff" />
            </Pressable>

            {/* Anchored Tooltip Bubble: [NEW] New chat (Image 1) */}
            {!newChatTooltipDismissed && !toMenuOpen ? (
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
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <Icons.Download size={16} color={coworkUi.textSecondary} />
                </MeetingSheetButton>
              )
            ) : null
          }
        />
      )}

      <ScrollView
        flex={1}
        minHeight={0}
        padding="$3"
        ref={listRef as never}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
      >
        <YStack gap="$3">
          {!chatEnabled ? (
            <YStack
              padding="$5"
              alignItems="center"
              gap="$3"
              borderRadius={coworkUi.radius.panel}
              backgroundColor="rgba(255,255,255,0.03)"
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
            >
              <Icons.MessageSquare size={28} color={coworkUi.textMuted} />
              <Text color={coworkUi.textMuted} textAlign="center" fontSize={13} lineHeight={19}>
                The host disabled in-meeting chat.
              </Text>
            </YStack>
          ) : null}
          {chatEnabled && messages.length === 0 ? (
            <YStack
              padding="$5"
              alignItems="center"
              gap="$3"
              borderRadius={coworkUi.radius.panel}
              backgroundColor="rgba(255,255,255,0.03)"
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
            >
              <Icons.MessageSquare size={28} color={coworkUi.textMuted} />
              <Text color={coworkUi.textMuted} textAlign="center" fontSize={13} lineHeight={19}>
                No messages yet. Message everyone
                {privateChatEnabled ? ', a participant privately,' : ''}
                {canManageChat ? ' or hosts only.' : '.'}
              </Text>
            </YStack>
          ) : null}
          {messages.map((msg) => {
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
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius={18}
                  borderBottomRightRadius={isSelf ? 6 : 18}
                  borderBottomLeftRadius={isSelf ? 18 : 6}
                  backgroundColor={isSelf ? coworkUi.chatBubbleSelf : coworkUi.chatBubbleOther}
                  borderWidth={1}
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
                      Hosts only
                    </Text>
                  ) : null}
                  {isPrivate ? (
                    <Text fontSize={10} fontWeight="700" color={coworkUi.brandLight}>
                      {isSelf ? `Private to ${privatePeerName}` : 'Private message'}
                    </Text>
                  ) : null}
                  <Text fontSize={14} color={coworkUi.text} lineHeight={20}>
                    {msg.message_text}
                  </Text>
                </YStack>
              </XStack>
            )
          })}
        </YStack>
      </ScrollView>

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
                      Hosts only
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
                        Hosts only
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chat attachments"
            disabled={!chatEnabled}
            onPress={() => {
              if (onAttach) {
                onAttach()
                return
              }
              toast.show('Attachments', {
                tone: 'info',
                message: 'Share files from the meeting Share menu for now.',
              })
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: coworkUi.meetingControl,
              borderWidth: 1,
              borderColor: coworkUi.glassBorder,
              opacity: chatEnabled ? 1 : 0.45,
            }}
          >
            <Icons.Plus size={20} color={coworkUi.text} />
          </Pressable>
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
              onSubmitEditing={send}
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
              onSubmitEditing={send}
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
            accessibilityLabel="Insert emoji"
            disabled={!chatEnabled}
            onPress={() => {
              if (!chatEnabled) return
              setDraft((value) => `${value}👍`)
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: coworkUi.meetingControl,
              borderWidth: 1,
              borderColor: coworkUi.glassBorder,
              opacity: chatEnabled ? 1 : 0.45,
            }}
          >
            <Icons.Smile size={20} color={coworkUi.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send chat message"
            disabled={sendDisabled || !draft.trim()}
            onPress={send}
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
    </CoWorkPanelShell>
  )
}
