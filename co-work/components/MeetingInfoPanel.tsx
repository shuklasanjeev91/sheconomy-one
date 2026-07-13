import { useState } from 'react'

import { ShareSheet } from '~/components/share'
import { Button, Icons, ScrollView, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkPanelShell, CoWorkSectionLabel, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { formatMeetingCode, getMeetingShareUrl } from '~/co-work/lib/meetings'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { Meeting } from '~/co-work/lib/types'
import { BRAND_MEMBER_LABEL } from '~/config/brand'
import { copyShareLink } from '~/lib/share'

type MeetingInfoPanelProps = {
  meeting: Meeting
  participantCount: number
  isHost: boolean
  onClose: () => void
  onInvite?: () => void
  fullWidth?: boolean
}

export function MeetingInfoPanel({
  meeting,
  participantCount,
  isHost,
  onClose,
  onInvite,
  fullWidth,
}: MeetingInfoPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const [shareOpen, setShareOpen] = useState(false)

  const shareUrl = getMeetingShareUrl(meeting.meeting_code)
  const hostName = meeting.host?.full_name || meeting.host?.username || BRAND_MEMBER_LABEL
  const security = meeting.security_settings
  const invitees = meeting.invitees ?? []
  const formattedCode = formatMeetingCode(meeting.meeting_code)

  async function handleCopy(value: string, label: string) {
    const copied = await copyShareLink(value)
    if (copied) {
      toast.show(`${label} copied`, { tone: 'success' })
      return
    }
    toast.show(`Could not copy ${label.toLowerCase()}`, { tone: 'error' })
  }

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Meeting information"
        subtitle={`${participantCount} in this session`}
        icon={<Icons.Info size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <ScrollView flex={1} padding="$3">
        <YStack gap="$4">
          <YStack gap="$2">
            <CoWorkSectionLabel>Topic</CoWorkSectionLabel>
            <Text fontSize={16} fontWeight="800" color={coworkUi.text} letterSpacing={-0.3}>
              {meeting.title}
            </Text>
            {meeting.description ? (
              <Text fontSize={13} color={coworkUi.textSecondary} lineHeight={19}>
                {meeting.description}
              </Text>
            ) : null}
          </YStack>

          <InfoRow label="Host" value={hostName} />
          <InfoRow
            label="Meeting ID"
            value={formattedCode}
            actionLabel="Copy"
            onAction={() => void handleCopy(meeting.meeting_code.replace(/\s/g, ''), 'Meeting ID')}
          />
          <InfoRow
            label="Invite link"
            value={shareUrl}
            actionLabel="Copy"
            onAction={() => void handleCopy(shareUrl, 'Invite link')}
            mono
          />

          {security?.passcode || security?.requirePasscode ? (
            <InfoRow
              label="Passcode"
              value={security.passcode ? '••••••' : 'Required'}
              actionLabel={security.passcode ? 'Copy' : undefined}
              onAction={
                security.passcode
                  ? () => void handleCopy(security.passcode!, 'Passcode')
                  : undefined
              }
            />
          ) : null}

          <YStack gap="$2">
            <CoWorkSectionLabel>Security</CoWorkSectionLabel>
            <XStack gap="$2" flexWrap="wrap">
              <CoWorkStatusPill label="Encrypted" tone="live" />
              {security?.waitingRoom !== false ? (
                <CoWorkStatusPill label="Waiting room" tone="brand" />
              ) : null}
              {security?.muteOnJoin ? <CoWorkStatusPill label="Mute on join" tone="coral" /> : null}
              {security?.allowScreenShare === false ? (
                <CoWorkStatusPill label="Share locked" tone="warning" />
              ) : null}
              {security?.allowRecording === false ? (
                <CoWorkStatusPill label="No recording" tone="warning" />
              ) : null}
            </XStack>
          </YStack>

          {invitees.length > 0 ? (
            <YStack gap="$2">
              <CoWorkSectionLabel>Shared with</CoWorkSectionLabel>
              <Text fontSize={12} color={coworkUi.textMuted}>
                People who received this meeting link
              </Text>
              {invitees.map((invitee) => (
                <XStack
                  key={invitee.id}
                  alignItems="center"
                  justifyContent="space-between"
                  gap="$2"
                  padding="$3"
                  borderRadius={14}
                  backgroundColor="rgba(255,255,255,0.04)"
                  borderWidth={1}
                  borderColor={coworkUi.borderSoft}
                >
                  <YStack flex={1} gap={2}>
                    <Text fontSize={14} fontWeight="700" color={coworkUi.text} numberOfLines={1}>
                      {invitee.name || invitee.email || 'Guest'}
                    </Text>
                    {invitee.email ? (
                      <Text fontSize={11} color={coworkUi.textMuted} numberOfLines={1}>
                        {invitee.email}
                      </Text>
                    ) : null}
                  </YStack>
                  <CoWorkStatusPill
                    label={
                      invitee.status === 'joined'
                        ? 'Joined'
                        : invitee.status === 'sent'
                          ? 'Invited'
                          : 'Pending'
                    }
                    tone={invitee.status === 'joined' ? 'live' : 'brand'}
                  />
                </XStack>
              ))}
            </YStack>
          ) : (
            <YStack
              gap="$2"
              padding="$3"
              borderRadius={14}
              backgroundColor="rgba(255,255,255,0.04)"
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
            >
              <Text fontSize={13} fontWeight="700" color={coworkUi.text}>
                No invites sent yet
              </Text>
              <Text fontSize={12} color={coworkUi.textMuted} lineHeight={18}>
                Share the invite link or invite people so they can join this session.
              </Text>
            </YStack>
          )}
        </YStack>
      </ScrollView>

      <YStack padding="$3" gap="$2" borderTopWidth={1} borderTopColor={coworkUi.borderSoft}>
        <Button
          tone="primary"
          borderRadius={999}
          icon={<Icons.Share2 size={16} color="white" />}
          onPress={() => setShareOpen(true)}
        >
          Share invite link
        </Button>
        {isHost && onInvite ? (
          <Button
            tone="outline"
            borderRadius={999}
            borderColor={coworkUi.borderAccent}
            color={coworkUi.brandLight}
            icon={<Icons.UserPlus size={16} color={coworkUi.brandLight} />}
            onPress={onInvite}
          >
            Invite people
          </Button>
        ) : null}
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

function InfoRow({
  label,
  value,
  actionLabel,
  onAction,
  mono,
}: {
  label: string
  value: string
  actionLabel?: string
  onAction?: () => void
  mono?: boolean
}) {
  const { ui: coworkUi } = useCoWorkTheme()

  return (
    <YStack gap="$2">
      <CoWorkSectionLabel>{label}</CoWorkSectionLabel>
      <XStack
        alignItems="center"
        gap="$2"
        padding="$3"
        borderRadius={14}
        backgroundColor="rgba(255,255,255,0.04)"
        borderWidth={1}
        borderColor={coworkUi.borderSoft}
      >
        <Text
          flex={1}
          fontSize={mono ? 12 : 14}
          fontWeight={mono ? '600' : '700'}
          color={coworkUi.text}
          numberOfLines={2}
        >
          {value}
        </Text>
        {actionLabel && onAction ? (
          <Button
            tone="ghost"
            size="$2"
            borderRadius={999}
            color={coworkUi.brandLight}
            icon={<Icons.Copy size={14} color={coworkUi.brandLight} />}
            onPress={onAction}
          >
            {actionLabel}
          </Button>
        ) : null}
      </XStack>
    </YStack>
  )
}
