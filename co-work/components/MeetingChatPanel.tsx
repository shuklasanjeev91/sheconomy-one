import { useEffect, useMemo, useRef, useState } from 'react'

import { Avatar, Button, Icons, Input, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { CoWorkPanelShell } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingChatMessage, MeetingParticipant } from '~/co-work/lib/types'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'
import type { MeetingChatAudience } from '~/co-work/lib/meeting-role-permissions'
import {
  canDeleteMeetingChatMessage,
  isMeetingSystemChatMessage,
  meetingChatComposerAudiences,
} from '~/co-work/lib/meeting-chat'
import type { MeetingRole } from '~/co-work/lib/types'

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
  canManageChat?: boolean
  participantDisplayNames?: Record<string, string>
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
  canManageChat = false,
  participantDisplayNames = {},
}: MeetingChatPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [draft, setDraft] = useState('')
  const [audience, setAudience] = useState<MeetingChatAudience>('everyone')
  const [recipientId, setRecipientId] = useState<string | null>(null)
  const listRef = useRef<{ scrollToEnd?: (opts?: { animated?: boolean }) => void } | null>(null)

  const audiences = useMemo(
    () =>
      meetingChatComposerAudiences({
        viewerRole,
        privateEnabled: privateChatEnabled,
      }),
    [privateChatEnabled, viewerRole],
  )

  const privateTargets = useMemo(
    () =>
      participants.filter(
        (row) => row.status === 'admitted' && row.user_id !== currentUserId,
      ),
    [currentUserId, participants],
  )

  useEffect(() => {
    if (!audiences.includes(audience)) setAudience('everyone')
  }, [audience, audiences])

  useEffect(() => {
    listRef.current?.scrollToEnd?.({ animated: true })
  }, [messages.length])

  function send() {
    if (!chatEnabled || !draft.trim()) return
    if (audience === 'private' && !recipientId) return
    onSend(draft.trim(), audience, audience === 'private' ? recipientId : null)
    setDraft('')
  }

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Meeting Chat"
        subtitle={
          chatEnabled
            ? `${messages.length} message${messages.length === 1 ? '' : 's'} · This meeting only`
            : 'Chat is turned off for this meeting'
        }
        icon={<Icons.MessageSquare size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <ScrollView
        flex={1}
        padding="$3"
        ref={listRef as never}
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
        padding="$3"
        gap="$2"
        borderTopWidth={1}
        borderTopColor={coworkUi.borderSoft}
        backgroundColor="rgba(0,0,0,0.15)"
      >
        {chatEnabled && audiences.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$2">
              {audiences.map((value) => (
                <Button
                  key={value}
                  tone={audience === value ? 'primary' : 'outline'}
                  size="$2"
                  borderRadius={999}
                  onPress={() => setAudience(value)}
                >
                  {value === 'everyone' ? 'Everyone' : value === 'hosts' ? 'Hosts only' : 'Private'}
                </Button>
              ))}
            </XStack>
          </ScrollView>
        ) : null}
        {chatEnabled && audience === 'private' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$2">
              {privateTargets.length === 0 ? (
                <Text fontSize={12} color={coworkUi.textMuted}>
                  No other participants yet.
                </Text>
              ) : (
                privateTargets.map((row) => {
                  const name = safeMeetingDisplayName(
                    participantDisplayNames[row.user_id] ||
                      row.display_name ||
                      row.profile?.full_name ||
                      row.profile?.username,
                  )
                  return (
                    <Button
                      key={row.user_id}
                      tone={recipientId === row.user_id ? 'primary' : 'outline'}
                      size="$2"
                      borderRadius={999}
                      onPress={() => setRecipientId(row.user_id)}
                    >
                      {name}
                    </Button>
                  )
                })
              )}
            </XStack>
          </ScrollView>
        ) : null}
        <XStack gap="$2">
          <Input
            flex={1}
            value={draft}
            onChangeText={setDraft}
            editable={chatEnabled}
            placeholder={
              !chatEnabled
                ? 'Chat is disabled'
                : audience === 'hosts'
                  ? 'Message hosts and co-hosts…'
                  : audience === 'private'
                    ? recipientId
                      ? 'Write a private message…'
                      : 'Choose a participant…'
                    : 'Message everyone…'
            }
            backgroundColor="rgba(255,255,255,0.05)"
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
            placeholderTextColor={coworkUi.textMuted}
            borderRadius={14}
            onSubmitEditing={send}
          />
          <Button
            tone="primary"
            size="$3"
            borderRadius={14}
            disabled={!chatEnabled || (audience === 'private' && !recipientId)}
            onPress={send}
          >
            Send
          </Button>
        </XStack>
      </YStack>
    </CoWorkPanelShell>
  )
}
