import { useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useMemo, useState } from 'react'

import { RequireAuth } from '~/components/auth/RequireAuth'
import { AppPage, LAYOUT_STRETCH } from '~/components/layout'
import { Button, Field, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { clearFormDraft } from '~/lib/drafts/form-draft'
import { useFormDraft } from '~/hooks/useFormDraft'
import { useUnsavedChangesGuard } from '~/hooks/useUnsavedChangesGuard'
import { CoWorkBrandChip } from '~/co-work/components/CoWorkUi'
import { MeetingAiDraftPanel } from '~/co-work/components/MeetingAiDraftPanel'
import { defaultScheduleDateTime, ScheduleDateTimeField } from '~/co-work/components/ScheduleDateTimeField'
import { ScheduleSection, ScheduleToggleRow } from '~/co-work/components/ScheduleFormFields'
import { MeetingInvitePicker } from '~/co-work/components/MeetingInvitePicker'
import { createMeeting } from '~/co-work/lib/meetings'
import { sendMeetingInvites, buildInviteMailtoLink, emailToInvitee } from '~/co-work/lib/invites'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import type { MeetingInvitee, MeetingRepeat } from '~/co-work/lib/types'
import { coWorkRoutes } from '~/lib/routes'
import { recordMeetingCode } from '~/co-work/lib/recent-meeting-codes'
import { buildMeetingCalendarEvent, shareIcsFile } from '~/lib/calendar/ics'
import { openMailtoLink } from '~/lib/platform/openMailto'
import { useProfile } from '~/hooks/useProfile'

import { BRAND_NAME } from '~/config/brand'

const MEETING_DRAFT_KEY = 'cowork-schedule-meeting'

const REPEAT_OPTIONS: { label: string; value: MeetingRepeat }[] = [
  { label: 'Does not repeat', value: null },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]

export function ScheduleMeetingScreen() {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const router = useRouter()
  const toast = useAppToast()
  const { user, profile, isAuthenticated } = useProfile()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleDateTime)
  const [maxParticipants, setMaxParticipants] = useState('100')
  const [passcode, setPasscode] = useState('')
  const [waitingRoom, setWaitingRoom] = useState(true)
  const [muteOnJoin, setMuteOnJoin] = useState(false)
  const [videoOffOnJoin, setVideoOffOnJoin] = useState(false)
  const [authenticatedOnly, setAuthenticatedOnly] = useState(true)
  const [allowScreenShare, setAllowScreenShare] = useState(true)
  const [allowChat, setAllowChat] = useState(true)
  const [allowRecording, setAllowRecording] = useState(true)
  const [allowHandRaise, setAllowHandRaise] = useState(true)
  const [defaultVideo, setDefaultVideo] = useState(true)
  const [defaultAudio, setDefaultAudio] = useState(true)
  const [allowJoinBeforeHost, setAllowJoinBeforeHost] = useState(false)
  const [autoRecord, setAutoRecord] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [repeat, setRepeat] = useState<MeetingRepeat>(null)
  const [invitees, setInvitees] = useState<MeetingInvitee[]>([])
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  function onTitleChange(value: string) {
    setTitle(value)
    setFieldErrors((current) => ({
      ...current,
      title: value.trim() ? '' : 'Add a meeting title',
    }))
  }

  function onMaxParticipantsChange(value: string) {
    setMaxParticipants(value)
    const capacity = Number.parseInt(value, 10)
    const invalid = !Number.isFinite(capacity) || capacity < 2 || capacity > 500
    setFieldErrors((current) => ({
      ...current,
      maxParticipants: invalid ? 'Capacity must be between 2 and 500' : '',
    }))
  }

  const draftValue = useMemo(
    () => ({
      title,
      description,
      scheduledAt,
      maxParticipants,
      passcode,
      waitingRoom,
      muteOnJoin,
      videoOffOnJoin,
      authenticatedOnly,
      allowScreenShare,
      allowChat,
      allowRecording,
      allowHandRaise,
      defaultVideo,
      defaultAudio,
      allowJoinBeforeHost,
      autoRecord,
      isRecurring,
      repeat,
    }),
    [
      allowChat,
      allowHandRaise,
      allowJoinBeforeHost,
      allowRecording,
      allowScreenShare,
      authenticatedOnly,
      autoRecord,
      defaultAudio,
      defaultVideo,
      description,
      isRecurring,
      maxParticipants,
      muteOnJoin,
      passcode,
      repeat,
      scheduledAt,
      title,
      videoOffOnJoin,
      waitingRoom,
    ],
  )
  const isDraftDirty = Boolean(title.trim() || description.trim())
  useFormDraft({
    key: user ? MEETING_DRAFT_KEY : null,
    value: draftValue,
    isDirty: () => isDraftDirty,
    onRestored: (draft) => {
      if (!draft) return
      if (typeof draft.title === 'string') setTitle(draft.title)
      if (typeof draft.description === 'string') setDescription(draft.description)
      if (typeof draft.scheduledAt === 'string') setScheduledAt(draft.scheduledAt)
      if (typeof draft.maxParticipants === 'string') setMaxParticipants(draft.maxParticipants)
      if (typeof draft.passcode === 'string') setPasscode(draft.passcode)
      if (typeof draft.waitingRoom === 'boolean') setWaitingRoom(draft.waitingRoom)
      if (typeof draft.muteOnJoin === 'boolean') setMuteOnJoin(draft.muteOnJoin)
      if (typeof draft.videoOffOnJoin === 'boolean') setVideoOffOnJoin(draft.videoOffOnJoin)
      if (typeof draft.authenticatedOnly === 'boolean') setAuthenticatedOnly(draft.authenticatedOnly)
      if (typeof draft.allowScreenShare === 'boolean') setAllowScreenShare(draft.allowScreenShare)
      if (typeof draft.allowChat === 'boolean') setAllowChat(draft.allowChat)
      if (typeof draft.allowRecording === 'boolean') setAllowRecording(draft.allowRecording)
      if (typeof draft.allowHandRaise === 'boolean') setAllowHandRaise(draft.allowHandRaise)
      if (typeof draft.defaultVideo === 'boolean') setDefaultVideo(draft.defaultVideo)
      if (typeof draft.defaultAudio === 'boolean') setDefaultAudio(draft.defaultAudio)
      if (typeof draft.allowJoinBeforeHost === 'boolean') {
        setAllowJoinBeforeHost(draft.allowJoinBeforeHost)
      }
      if (typeof draft.autoRecord === 'boolean') setAutoRecord(draft.autoRecord)
      if (typeof draft.isRecurring === 'boolean') setIsRecurring(draft.isRecurring)
      if (draft.repeat !== undefined) setRepeat(draft.repeat)
    },
  })
  useUnsavedChangesGuard({ isDirty: isDraftDirty && !saving })

  if (!isAuthenticated || !user) {
    return <RequireAuth redirectTo={coWorkRoutes.schedule} />
  }

  async function handleSchedule() {
    if (!title.trim()) {
      setFieldErrors((current) => ({ ...current, title: 'Add a meeting title' }))
      toast.show('Add a meeting title', { tone: 'danger' })
      return
    }

    const capacity = Number.parseInt(maxParticipants, 10)
    if (!Number.isFinite(capacity) || capacity < 2 || capacity > 500) {
      setFieldErrors((current) => ({
        ...current,
        maxParticipants: 'Capacity must be between 2 and 500',
      }))
      toast.show('Capacity must be between 2 and 500', { tone: 'danger' })
      return
    }

    if (!scheduledAt) {
      toast.show('Choose a date and time', { tone: 'danger' })
      return
    }

    setSaving(true)
    try {
      const meeting = await createMeeting(user.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt,
        timeZone,
        maxParticipants: capacity,
        isRecurring,
        repeat: isRecurring ? repeat : null,
        securitySettings: {
          passcode: passcode.trim() || undefined,
          requirePasscode: !!passcode.trim(),
          waitingRoom,
          muteOnJoin,
          videoOffOnJoin,
          authenticatedUsersOnly: authenticatedOnly,
          allowScreenShare,
          allowChat,
          allowRecording,
          allowHandRaise,
        },
        meetingOptions: {
          layout: 'grid',
          defaultVideo,
          defaultAudio,
          allowJoinBeforeHost,
          autoRecord,
          enableMeetingChat: allowChat,
        },
        invitees,
      })

      if (invitees.length > 0) {
        try {
          const result = await sendMeetingInvites({
            meetingId: meeting.id,
            invitees,
          })

          if (result.mailtoLinks?.length) {
            const hostName = profile?.full_name || profile?.username || 'You'
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
        } catch {
          toast.show('Meeting scheduled — open the lobby to resend invites', { tone: 'info' })
        }
      } else {
        await clearFormDraft(MEETING_DRAFT_KEY)
        toast.show('Meeting scheduled', { tone: 'success' })
      }

      recordMeetingCode(meeting.meeting_code)

      const ics = buildMeetingCalendarEvent({
        title: meeting.title,
        description: meeting.description,
        scheduledAt: meeting.scheduled_at ?? scheduledAt,
        meetingCode: meeting.meeting_code,
      })
      await shareIcsFile(ics, `sheconomy-${meeting.meeting_code}.ics`)

      router.push(coWorkRoutes.meeting(meeting.meeting_code))
    } catch (scheduleError) {
      toast.show('Could not schedule meeting', {
        tone: 'danger',
        message: scheduleError instanceof Error ? scheduleError.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppPage
      scroll
      form
      backgroundColor={coworkUi.pageBg}
      paddingVertical="$6"
      style={pageGradientStyle(coworkGradients.page, coworkUi.pageBg)}
    >
      <YStack gap="$5" width="100%" {...LAYOUT_STRETCH}>
        <YStack gap="$3">
          <CoWorkBrandChip label="SCHEDULE" />
          <Text fontSize={30} fontWeight="800" color={coworkUi.text} letterSpacing={-0.8}>
            Plan a Co-Work session
          </Text>
          <Text color={coworkUi.textSecondary} lineHeight={22}>
            Describe the meeting with AI, or set the title, time, security, and invitees yourself.
          </Text>
        </YStack>

        <MeetingAiDraftPanel
          timeZone={timeZone}
          onApply={(draft) => {
            setTitle(draft.title)
            setDescription(draft.description)
            if (draft.scheduledAt) setScheduledAt(draft.scheduledAt)
            if (draft.maxParticipants) setMaxParticipants(String(draft.maxParticipants))
          }}
        />

        <YStack
          gap="$5"
          padding="$5"
          borderRadius={coworkUi.radius.card}
          borderWidth={1}
          borderColor={coworkUi.glassBorder}
          style={{
            ...coworkGlassStyle(coworkUi, true),
            ...coworkBoxShadow(coworkShadows, 'card'),
          }}
        >
          <ScheduleSection title="Details">
            <Field label="Title" error={fieldErrors.title || undefined} required>
              <Input
                value={title}
                onChangeText={onTitleChange}
                placeholder={`${profile?.full_name || 'Team'} sync`}
                backgroundColor="rgba(255,255,255,0.05)"
                borderColor={fieldErrors.title ? coworkUi.danger : coworkUi.borderSoft}
                color={coworkUi.text}
                borderRadius={14}
                invalid={Boolean(fieldErrors.title)}
              />
            </Field>
            <Field label="Description">
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Agenda, goals, or notes for attendees"
                backgroundColor="rgba(255,255,255,0.05)"
                borderColor={coworkUi.borderSoft}
                color={coworkUi.text}
                borderRadius={14}
                multiline
              />
            </Field>
            <ScheduleDateTimeField value={scheduledAt} onChange={setScheduledAt} />
            <Field label={`Timezone · ${timeZone}`}>
              <Text fontSize={12} color={coworkUi.textMuted}>
                Invitees will see the meeting time in this timezone.
              </Text>
            </Field>
            <Field label="Max participants" error={fieldErrors.maxParticipants || undefined}>
              <Input
                value={maxParticipants}
                onChangeText={onMaxParticipantsChange}
                keyboardType="number-pad"
                backgroundColor="rgba(255,255,255,0.05)"
                borderColor={fieldErrors.maxParticipants ? coworkUi.danger : coworkUi.borderSoft}
                color={coworkUi.text}
                borderRadius={14}
                invalid={Boolean(fieldErrors.maxParticipants)}
              />
            </Field>
          </ScheduleSection>

          <ScheduleSection title="Invite people">
            <Text fontSize={13} color={coworkUi.textSecondary} marginBottom="$2">
              Add {BRAND_NAME} members or guests by email — like Zoom or Google Meet.
            </Text>
            <MeetingInvitePicker hostId={user.id} value={invitees} onChange={setInvitees} />
          </ScheduleSection>

          <ScheduleSection title="Recurrence">
            <ScheduleToggleRow
              label="Recurring meeting"
              description="Repeat this session on a schedule"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
            {isRecurring ? (
              <XStack gap="$2" flexWrap="wrap">
                {REPEAT_OPTIONS.filter((opt) => opt.value !== null).map((opt) => (
                  <Button
                    key={opt.label}
                    size="$2"
                    borderRadius={999}
                    tone={repeat === opt.value ? 'primary' : 'outline'}
                    borderColor={repeat === opt.value ? coworkUi.brand : coworkUi.borderSoft}
                    onPress={() => setRepeat(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </XStack>
            ) : null}
          </ScheduleSection>

          <ScheduleSection title="Security">
            <Field label="Passcode (optional)">
              <Input
                value={passcode}
                onChangeText={setPasscode}
                secureTextEntry
                placeholder="Guests enter this before joining"
                backgroundColor="rgba(255,255,255,0.05)"
                borderColor={coworkUi.borderSoft}
                color={coworkUi.text}
                borderRadius={14}
              />
            </Field>
            <ScheduleToggleRow
              label="Waiting room"
              description="Admit attendees before they enter the room"
              checked={waitingRoom}
              onCheckedChange={setWaitingRoom}
            />
            <ScheduleToggleRow
              label={`${BRAND_NAME} members only`}
              description={`Require a signed-in ${BRAND_NAME} account`}
              checked={authenticatedOnly}
              onCheckedChange={setAuthenticatedOnly}
            />
            <ScheduleToggleRow
              label="Mute on join"
              checked={muteOnJoin}
              onCheckedChange={setMuteOnJoin}
            />
            <ScheduleToggleRow
              label="Camera off on join"
              checked={videoOffOnJoin}
              onCheckedChange={setVideoOffOnJoin}
            />
          </ScheduleSection>

          <ScheduleSection title="Room features">
            <ScheduleToggleRow label="Screen sharing" checked={allowScreenShare} onCheckedChange={setAllowScreenShare} />
            <ScheduleToggleRow label="In-meeting chat" checked={allowChat} onCheckedChange={setAllowChat} />
            <ScheduleToggleRow label="Recording" checked={allowRecording} onCheckedChange={setAllowRecording} />
            <ScheduleToggleRow label="Raise hand" checked={allowHandRaise} onCheckedChange={setAllowHandRaise} />
            <ScheduleToggleRow
              label="Join before host"
              checked={allowJoinBeforeHost}
              onCheckedChange={setAllowJoinBeforeHost}
            />
            <ScheduleToggleRow label="Auto-record" checked={autoRecord} onCheckedChange={setAutoRecord} />
          </ScheduleSection>

          <ScheduleSection title="Defaults">
            <ScheduleToggleRow label="Camera on by default" checked={defaultVideo} onCheckedChange={setDefaultVideo} />
            <ScheduleToggleRow label="Microphone on by default" checked={defaultAudio} onCheckedChange={setDefaultAudio} />
          </ScheduleSection>

          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            disabled={saving}
            icon={saving ? <Spinner size="small" color="white" /> : <Icons.Calendar size={18} color="white" />}
            onPress={() => void handleSchedule()}
            style={controlGradientStyle(coworkGradients.activeControl, coworkUi.brand)}
          >
            Schedule meeting
          </Button>
        </YStack>

        <AppLink href={coWorkRoutes.home} asChild>
          <Button tone="ghost">Open Co-Work</Button>
        </AppLink>
      </YStack>
    </AppPage>
  )
}