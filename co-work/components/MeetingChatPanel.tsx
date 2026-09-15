import { useState } from 'react'

import { Avatar, Button, Icons, Input, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { CoWorkPanelShell } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingChatMessage } from '~/co-work/lib/types'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'

type MeetingChatPanelProps = {
  messages: MeetingChatMessage[]
  onSend: (text: string) => void
  onClose: () => void
  fullWidth?: boolean
  currentUserId?: string
  participantDisplayNames?: Record<string, string>
}

export function MeetingChatPanel({
  messages,
  onSend,
  onClose,
  fullWidth,
  currentUserId,
  participantDisplayNames = {},
}: MeetingChatPanelProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const [draft, setDraft] = useState('')

  function send() {
    if (!draft.trim()) return
    onSend(draft.trim())
    setDraft('')
  }

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Chat"
        subtitle={`${messages.length} message${messages.length === 1 ? '' : 's'}`}
        icon={<Icons.MessageSquare size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <ScrollView flex={1} padding="$3">
        <YStack gap="$3">
          {messages.length === 0 ? (
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
                No messages yet. Start the conversation with everyone in the room.
              </Text>
            </YStack>
          ) : null}
          {messages.map((msg) => {
            const isSelf = currentUserId ? msg.sender_id === currentUserId : false
            const senderName = safeMeetingDisplayName(
              participantDisplayNames[msg.sender_id] ||
                msg.sender?.full_name ||
                msg.sender?.username,
            )
            return (
              <XStack key={msg.id} gap="$2" alignItems="flex-end" justifyContent={isSelf ? 'flex-end' : 'flex-start'}>
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
                  borderRadius={isSelf ? 18 : 18}
                  borderBottomRightRadius={isSelf ? 6 : 18}
                  borderBottomLeftRadius={isSelf ? 18 : 6}
                  backgroundColor={isSelf ? coworkUi.chatBubbleSelf : coworkUi.chatBubbleOther}
                  borderWidth={1}
                  borderColor={isSelf ? coworkUi.borderAccent : coworkUi.borderSoft}
                  gap={4}
                >
                  {!isSelf ? (
                    <Text fontSize={11} fontWeight="700" color={coworkUi.brandLight}>
                      {senderName}
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

      <XStack
        padding="$3"
        gap="$2"
        borderTopWidth={1}
        borderTopColor={coworkUi.borderSoft}
        backgroundColor="rgba(0,0,0,0.15)"
      >
        <Input
          flex={1}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message…"
          backgroundColor="rgba(255,255,255,0.05)"
          borderColor={coworkUi.borderSoft}
          color={coworkUi.text}
          placeholderTextColor={coworkUi.textMuted}
          borderRadius={14}
          onSubmitEditing={send}
        />
        <Button tone="primary" size="$3" borderRadius={14} onPress={send}>
          Send
        </Button>
      </XStack>
    </CoWorkPanelShell>
  )
}