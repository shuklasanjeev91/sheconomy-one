import { useState } from 'react'
import { Platform, Linking } from 'react-native'

import { Button, Icons, Input, ScrollView, Spinner, YStack, useAppToast } from '~/components/ui'
import { CoWorkPanelShell, CoWorkSectionLabel } from '~/co-work/components/CoWorkUi'
import { MeetingInvitePicker } from '~/co-work/components/MeetingInvitePicker'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import {
  buildInviteMailtoLink,
  emailToInvitee,
  mergeInvitees,
  sendMeetingInvites,
} from '~/co-work/lib/invites'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { Meeting, MeetingInvitee } from '~/co-work/lib/types'

type MeetingInvitePanelProps = {
  meeting: Meeting
  hostId: string
  hostName: string
  onClose: () => void
  fullWidth?: boolean
  onInviteesUpdated?: (invitees: MeetingInvitee[]) => void
}

export function MeetingInvitePanel({
  meeting,
  hostId,
  hostName,
  onClose,
  fullWidth,
  onInviteesUpdated,
}: MeetingInvitePanelProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const toast = useAppToast()
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<MeetingInvitee[]>(meeting.invitees ?? [])
  const [sending, setSending] = useState(false)

  async function handleSendInvites() {
    const pending = selected.filter((item) => item.status !== 'joined')
    if (pending.length === 0) {
      toast.show('Add people to invite first', { tone: 'error' })
      return
    }

    setSending(true)
    try {
      const result = await sendMeetingInvites({
        meetingId: meeting.id,
        invitees: pending,
        message,
      })

      const updated = mergeInvitees(meeting.invitees ?? [], pending).map((item) => ({
        ...item,
        status: 'sent' as const,
      }))
      setSelected(updated)
      onInviteesUpdated?.(updated)

      if (result.mailtoLinks?.length) {
        for (const link of result.mailtoLinks) {
          const email = link.replace('mailto:', '')
          const mailto = buildInviteMailtoLink(meeting, emailToInvitee(email), hostName)
          if (Platform.OS === 'web') {
            window.open(mailto, '_blank')
          } else {
            await Linking.openURL(mailto)
          }
        }
      }

      toast.show('Invites sent', {
        tone: 'success',
        message: `${result.notifications ?? 0} in-app · ${result.emailsSent ?? 0} email`,
      })
    } catch (sendError) {
      toast.show('Could not send invites', {
        tone: 'error',
        message: sendError instanceof Error ? sendError.message : undefined,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Invite people"
        subtitle={`${selected.length} selected`}
        icon={<Icons.UserPlus size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <ScrollView flex={1} padding="$3">
        <MeetingInvitePicker hostId={hostId} value={selected} onChange={setSelected} compact />

        <YStack gap="$2" marginTop="$4">
          <CoWorkSectionLabel>Optional message</CoWorkSectionLabel>
          <Input
            value={message}
            onChangeText={setMessage}
            placeholder="Add a note for your invitees"
            backgroundColor="rgba(255,255,255,0.05)"
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
            borderRadius={14}
            multiline
          />
        </YStack>
      </ScrollView>

      <YStack padding="$3" gap="$2" borderTopWidth={1} borderTopColor={coworkUi.borderSoft}>
        <Button
          tone="primary"
          borderRadius={999}
          disabled={sending || selected.length === 0}
          icon={sending ? <Spinner size="small" color="white" /> : <Icons.Send size={16} color="white" />}
          onPress={() => void handleSendInvites()}
        >
          Send invites
        </Button>
      </YStack>
    </CoWorkPanelShell>
  )
}