import { useState } from 'react'

import { ShareSheet } from '~/components/share'
import { Button, Icons, Input, ScrollView, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { openMailtoLink } from '~/lib/platform/openMailto'
import { CoWorkPanelShell, CoWorkSectionLabel } from '~/co-work/components/CoWorkUi'
import { MeetingInvitePicker } from '~/co-work/components/MeetingInvitePicker'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import {
  buildInviteMailtoLink,
  emailToInvitee,
  mergeInvitees,
  sendMeetingInvites,
} from '~/co-work/lib/invites'
import { formatMeetingCode, getMeetingShareUrl } from '~/co-work/lib/meetings'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { Meeting, MeetingInvitee } from '~/co-work/lib/types'
import { copyShareLink } from '~/lib/share'

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
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<MeetingInvitee[]>(meeting.invitees ?? [])
  const [sending, setSending] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const shareUrl = getMeetingShareUrl(meeting.meeting_code)

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
          await openMailtoLink(mailto)
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
        <YStack gap="$3" marginBottom="$4">
          <CoWorkSectionLabel>Invite link</CoWorkSectionLabel>
          <YStack
            gap="$2"
            padding="$3"
            borderRadius={14}
            backgroundColor="rgba(255,255,255,0.04)"
            borderWidth={1}
            borderColor={coworkUi.borderSoft}
          >
            <Text fontSize={12} color={coworkUi.textMuted}>
              Meeting ID · {formatMeetingCode(meeting.meeting_code)}
            </Text>
            <Text fontSize={12} fontWeight="600" color={coworkUi.text} numberOfLines={2}>
              {shareUrl}
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              <Button
                tone="outline"
                size="$2"
                borderRadius={999}
                borderColor={coworkUi.borderAccent}
                color={coworkUi.brandLight}
                icon={<Icons.Copy size={14} color={coworkUi.brandLight} />}
                onPress={() => {
                  void copyShareLink(shareUrl).then((copied) => {
                    toast.show(copied ? 'Invite link copied' : 'Could not copy link', {
                      tone: copied ? 'success' : 'error',
                    })
                  })
                }}
              >
                Copy link
              </Button>
              <Button
                tone="outline"
                size="$2"
                borderRadius={999}
                borderColor={coworkUi.glassBorder}
                color={coworkUi.text}
                icon={<Icons.Share2 size={14} color={coworkUi.text} />}
                onPress={() => setShareOpen(true)}
              >
                Share
              </Button>
            </XStack>
          </YStack>
        </YStack>

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

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share meeting"
        copyLabel="Copy meeting link"
        copyToastMessage="Meeting link copied to clipboard."
        payload={{
          url: shareUrl,
          title: meeting.title,
        }}
      />
    </CoWorkPanelShell>
  )
}