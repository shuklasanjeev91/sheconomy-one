import { useEffect, useState } from 'react'

import { Button, Field, Icons, Input, ScrollView, Switch, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkPanelShell, CoWorkSectionLabel, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { MeetingShareSheet } from '~/co-work/components/MeetingShareSheet'
import { MeetingCalendarIconButton } from '~/co-work/components/MeetingCalendarIconButton'
import { formatMeetingCode, getMeetingShareUrl } from '~/co-work/lib/meetings'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { Meeting } from '~/co-work/lib/types'
import { BRAND_MEMBER_LABEL } from '~/config/brand'
import { copyShareLink } from '~/lib/share'
import { addMeetingToDeviceCalendar } from '~/lib/calendar/device-calendar'

type MeetingInfoPanelProps = {
  meeting: Meeting
  participantCount: number
  isHost: boolean
  onClose: () => void
  onInvite?: () => void
  onOpenRecordings?: () => void
  fullWidth?: boolean
  /** Local self-view mirror preference (default ON). */
  mirrorLocalVideo?: boolean
  onMirrorLocalVideoChange?: (enabled: boolean) => void
  hostLeaveBehavior?: 'end' | 'transfer_to_co_host' | null
  onHostLeaveBehaviorChange?: (behavior: 'end' | 'transfer_to_co_host') => void
  /** Zoom-style: open joined-participant picker and transfer host now. */
  onTransferHostPress?: () => void
  /** Open Participants so host can Make co-host from a person’s menu. */
  onOpenParticipants?: () => void
  /** Rename the live meeting topic for everyone. */
  onRenameTopic?: (title: string) => void
  /** Edit scheduled date/time/title outside the live room. */
  onEditSchedule?: () => void
  isLocked?: boolean
  onToggleLock?: () => void
}

export function MeetingInfoPanel({
  meeting,
  participantCount,
  isHost,
  onClose,
  onInvite,
  onOpenRecordings,
  fullWidth,
  mirrorLocalVideo = true,
  onMirrorLocalVideoChange,
  hostLeaveBehavior,
  onHostLeaveBehaviorChange,
  onTransferHostPress,
  onOpenParticipants,
  onRenameTopic,
  onEditSchedule,
  isLocked = false,
  onToggleLock,
}: MeetingInfoPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const [shareOpen, setShareOpen] = useState(false)
  const [topicDraft, setTopicDraft] = useState(meeting.title || '')

  useEffect(() => {
    setTopicDraft(meeting.title || '')
  }, [meeting.title])

  const shareUrl = getMeetingShareUrl(meeting.meeting_code)
  const hostName = meeting.host?.full_name || meeting.host?.username || BRAND_MEMBER_LABEL
  const security = meeting.security_settings
  const invitees = meeting.invitees ?? []
  const formattedCode = formatMeetingCode(meeting.meeting_code)
  const canEditSchedule =
    !!onEditSchedule && meeting.status !== 'cancelled' && meeting.status !== 'ended'

  async function handleCopy(value: string, label: string) {
    const copied = await copyShareLink(value)
    if (copied) {
      toast.show(`${label} copied`, { tone: 'success' })
      return
    }
    toast.show(`Could not copy ${label.toLowerCase()}`, { tone: 'error' })
  }

  async function addToCalendar() {
    const result = await addMeetingToDeviceCalendar(meeting)
    if (result === 'cancelled') return
    toast.show(
      result === 'saved' || result === 'opened'
        ? 'Meeting added to calendar'
        : result === 'shared'
          ? 'Calendar event ready'
          : 'Could not open calendar',
      { tone: result === 'saved' || result === 'opened' || result === 'shared' ? 'success' : 'danger' },
    )
  }

  function saveTopic() {
    const next = topicDraft.trim()
    if (!next || !onRenameTopic || next === meeting.title) return
    onRenameTopic(next)
    toast.show('Topic updated', { tone: 'success', message: 'Everyone sees the new meeting title.' })
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
            {isHost && onRenameTopic ? (
              <YStack gap="$2">
                <Field label="Meeting title">
                  <Input
                    value={topicDraft}
                    onChangeText={setTopicDraft}
                    placeholder={meeting.title || 'Meeting topic'}
                    backgroundColor="rgba(255,255,255,0.05)"
                    borderColor={coworkUi.borderSoft}
                    color={coworkUi.text}
                    borderRadius={14}
                  />
                </Field>
                <Button
                  size="$3"
                  tone="outline"
                  borderRadius={999}
                  disabled={!topicDraft.trim() || topicDraft.trim() === meeting.title}
                  onPress={saveTopic}
                >
                  Update title
                </Button>
              </YStack>
            ) : (
              <Text fontSize={16} fontWeight="800" color={coworkUi.text} letterSpacing={-0.3}>
                {meeting.title}
              </Text>
            )}
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
              {isLocked ? <CoWorkStatusPill label="Locked" tone="warning" /> : null}
              {security?.waitingRoom !== false ? (
                <CoWorkStatusPill label="Waiting room" tone="brand" />
              ) : null}
              {security?.passcode || security?.requirePasscode ? (
                <CoWorkStatusPill label="Passcode" tone="coral" />
              ) : null}
              {security?.muteOnJoin ? <CoWorkStatusPill label="Mute on join" tone="coral" /> : null}
              {security?.allowScreenShare === false ? (
                <CoWorkStatusPill label="Share locked" tone="warning" />
              ) : null}
              {security?.allowRecording === false ? (
                <CoWorkStatusPill label="No recording" tone="warning" />
              ) : null}
            </XStack>
            {isLocked ? (
              <Text fontSize={12} color={coworkUi.textMuted} lineHeight={17}>
                Meeting is locked. Use Security or Participants to unlock.
              </Text>
            ) : null}
          </YStack>

          {onMirrorLocalVideoChange ? (
            <YStack gap="$2">
              <CoWorkSectionLabel>Video</CoWorkSectionLabel>
              <XStack
                alignItems="center"
                justifyContent="space-between"
                gap="$3"
                padding="$3"
                borderRadius={14}
                backgroundColor="rgba(255,255,255,0.04)"
                borderWidth={1}
                borderColor={coworkUi.borderSoft}
              >
                <YStack flex={1} gap={2} minWidth={0}>
                  <Text fontSize={14} fontWeight="700" color={coworkUi.text}>
                    Mirror my video
                  </Text>
                  <Text fontSize={12} color={coworkUi.textMuted} lineHeight={17}>
                    Flip your self-view horizontally. Others still see you unmirrored.
                  </Text>
                </YStack>
                <Switch
                  checked={mirrorLocalVideo}
                  onCheckedChange={onMirrorLocalVideoChange}
                  aria-label="Mirror my video"
                />
              </XStack>
            </YStack>
          ) : null}

          {isHost && (onTransferHostPress || onOpenParticipants || canEditSchedule) ? (
            <YStack gap="$2">
              <CoWorkSectionLabel>Host controls</CoWorkSectionLabel>
              <YStack
                gap="$2"
                padding="$3"
                borderRadius={14}
                backgroundColor="rgba(255,255,255,0.04)"
                borderWidth={1}
                borderColor={coworkUi.borderSoft}
              >
                {onTransferHostPress ? (
                  <YStack gap="$2">
                    <Text fontSize={14} fontWeight="700" color={coworkUi.text}>
                      Transfer host
                    </Text>
                    <Text fontSize={12} color={coworkUi.textMuted} lineHeight={17}>
                      Pick someone who has joined. They become the host; you stay as a co-host.
                    </Text>
                    <Button
                      size="$3"
                      borderRadius={999}
                      tone="primary"
                      icon={<Icons.UserCheck size={16} color="white" />}
                      onPress={onTransferHostPress}
                    >
                      Choose a participant
                    </Button>
                  </YStack>
                ) : null}

                {onOpenParticipants ? (
                  <YStack gap="$2" marginTop={onTransferHostPress ? 8 : 0}>
                    <Text fontSize={14} fontWeight="700" color={coworkUi.text}>
                      Make a co-host
                    </Text>
                    <Text fontSize={12} color={coworkUi.textMuted} lineHeight={17}>
                      Open Participants, tap ··· next to a person, then Choose Make co-host.
                    </Text>
                    <Button
                      size="$3"
                      borderRadius={999}
                      tone="outline"
                      icon={<Icons.Users size={16} color={coworkUi.brandLight} />}
                      borderColor={coworkUi.borderAccent}
                      color={coworkUi.brandLight}
                      onPress={onOpenParticipants}
                    >
                      Open participants
                    </Button>
                  </YStack>
                ) : null}

                {canEditSchedule ? (
                  <YStack gap="$2" marginTop={onTransferHostPress || onOpenParticipants ? 8 : 0}>
                    <Text fontSize={14} fontWeight="700" color={coworkUi.text}>
                      Date and details
                    </Text>
                    <Text fontSize={12} color={coworkUi.textMuted} lineHeight={17}>
                      {meeting.status === 'instant' || meeting.status === 'active'
                        ? 'Update the title, schedule a future time, or edit invitees.'
                        : 'Change the scheduled start, end, or invitees on the schedule screen.'}
                    </Text>
                    <Button
                      size="$3"
                      borderRadius={999}
                      tone="outline"
                      icon={<Icons.Calendar size={16} color={coworkUi.brandLight} />}
                      borderColor={coworkUi.borderAccent}
                      color={coworkUi.brandLight}
                      onPress={onEditSchedule}
                    >
                      {meeting.status === 'instant' || meeting.status === 'active'
                        ? 'Edit meeting details'
                        : 'Edit schedule'}
                    </Button>
                  </YStack>
                ) : null}
              </YStack>
            </YStack>
          ) : null}

          {isHost && onHostLeaveBehaviorChange ? (
            <YStack gap="$2">
              <CoWorkSectionLabel>When you leave</CoWorkSectionLabel>
              <YStack
                gap="$2"
                padding="$3"
                borderRadius={14}
                backgroundColor="rgba(255,255,255,0.04)"
                borderWidth={1}
                borderColor={coworkUi.borderSoft}
              >
                <Text fontSize={12} color={coworkUi.textMuted} lineHeight={17}>
                  If you leave without ending the meeting, choose what happens next.
                </Text>
                <XStack gap="$2" flexWrap="wrap">
                  <Button
                    size="$2"
                    borderRadius={999}
                    tone={hostLeaveBehavior === 'transfer_to_co_host' ? 'primary' : 'ghost'}
                    onPress={() => onHostLeaveBehaviorChange('transfer_to_co_host')}
                  >
                    Pass to a co-host
                  </Button>
                  <Button
                    size="$2"
                    borderRadius={999}
                    tone={hostLeaveBehavior !== 'transfer_to_co_host' ? 'primary' : 'ghost'}
                    onPress={() => onHostLeaveBehaviorChange('end')}
                  >
                    End meeting
                  </Button>
                </XStack>
              </YStack>
            </YStack>
          ) : null}

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
        <XStack gap="$2" alignItems="center">
          <Button
            flex={1}
            tone="primary"
            borderRadius={999}
            icon={<Icons.Share2 size={16} color="white" />}
            onPress={() => setShareOpen(true)}
          >
            Share invite link
          </Button>
          <MeetingCalendarIconButton onPress={() => void addToCalendar()} />
        </XStack>
        {isHost && onOpenRecordings ? (
          <Button
            tone="outline"
            borderRadius={999}
            borderColor={coworkUi.borderAccent}
            color={coworkUi.brandLight}
            icon={<Icons.Circle size={16} color={coworkUi.brandLight} />}
            onPress={onOpenRecordings}
          >
            Recording history
          </Button>
        ) : null}
        {onInvite ? (
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

      <MeetingShareSheet open={shareOpen} onOpenChange={setShareOpen} meeting={meeting} />
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
