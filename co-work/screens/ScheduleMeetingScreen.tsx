import { useLocalSearchParams, useRouter } from 'one'
import { AppLink } from '~/components/navigation/AppLink'
import { useMemo, useState } from 'react'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
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
import { CalendarConnectionsPanel } from '~/co-work/components/CalendarConnectionsPanel'
import { createMeeting } from '~/co-work/lib/meetings'
import { sendMeetingInvites, buildInviteMailtoLink, emailToInvitee } from '~/co-work/lib/invites'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import type { MeetingInvitee, MeetingRepeat } from '~/co-work/lib/types'
import { coWorkRoutes } from '~/lib/routes'
import { recordMeetingCode } from '~/co-work/lib/recent-meeting-codes'
import { addMeetingToDeviceCalendar } from '~/lib/calendar/device-calendar'
import {
  calendarProviderLabel,
  syncMeetingToConnectedCalendars,
} from '~/lib/calendar/connections'
import { assertUtcIso, isValidIanaTimeZone, normalizeIanaTimeZone, rebaseUtcIsoWallClock, resolveDeviceIanaTimeZone, SCHEDULE_TIMEZONE_OPTIONS } from '~/lib/calendar/timezone'
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
  const params = useLocalSearchParams<{ prompt?: string | string[] }>()
  const aiPrompt = useMemo(() => {
    const raw = params.prompt
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }, [params.prompt])

  const [timeZone, setTimeZone] = useState(resolveDeviceIanaTimeZone)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => defaultScheduleDateTime(timeZone))
  const [scheduledEndAt, setScheduledEndAt] = useState(() =>
    new Date(Date.parse(defaultScheduleDateTime(timeZone)) + 60 * 60 * 1000).toISOString(),
  )
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
  const [captionsEnabled, setCaptionsEnabled] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [repeat, setRepeat] = useState<MeetingRepeat>(null)
  const [invitees, setInvitees] = useState<MeetingInvitee[]>([])
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function onTimeZoneChange(nextRaw: string) {
    const next = normalizeIanaTimeZone(nextRaw)
    setTimeZone(next)
    setFieldErrors((current) => ({
      ...current,
      timeZone: isValidIanaTimeZone(next) ? '' : 'Use an IANA timezone such as Asia/Kolkata',
    }))
    if (!isValidIanaTimeZone(next) || !isValidIanaTimeZone(timeZone) || next === timeZone) return
    // Keep the same wall clock (e.g. 10:00) when the host switches zones.
    try {
      const nextStart = rebaseUtcIsoWallClock(scheduledAt, timeZone, next)
      const nextEnd = rebaseUtcIsoWallClock(scheduledEndAt, timeZone, next)
      setScheduledAt(nextStart)
      setScheduledEndAt(nextEnd)
    } catch {
      // Leave existing instants if the wall clock is invalid in the new zone.
    }
  }

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
      scheduledEndAt,
      timeZone,
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
      captionsEnabled,
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
      captionsEnabled,
      defaultAudio,
      defaultVideo,
      description,
      isRecurring,
      maxParticipants,
      muteOnJoin,
      passcode,
      repeat,
      scheduledAt,
      scheduledEndAt,
      timeZone,
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
      if (typeof draft.scheduledEndAt === 'string') setScheduledEndAt(draft.scheduledEndAt)
      if (typeof draft.timeZone === 'string' && isValidIanaTimeZone(draft.timeZone)) {
        setTimeZone(draft.timeZone)
      }
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
      if (typeof draft.captionsEnabled === 'boolean') setCaptionsEnabled(draft.captionsEnabled)
      if (typeof draft.isRecurring === 'boolean') setIsRecurring(draft.isRecurring)
      if (draft.repeat !== undefined) setRepeat(draft.repeat)
    },
  })
  useUnsavedChangesGuard({ isDirty: isDraftDirty && !saving })

  if (!isAuthenticated || !user) {
    return <AuthSignInFlow returnTo={String(coWorkRoutes.schedule)} />
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
    if (!isValidIanaTimeZone(timeZone)) {
      setFieldErrors((current) => ({ ...current, timeZone: 'Enter a valid IANA timezone' }))
      toast.show('Enter a valid IANA timezone, such as Asia/Kolkata', { tone: 'danger' })
      return
    }
    let startsAt: string
    let endsAt: string
    try {
      startsAt = assertUtcIso(scheduledAt, 'Start time')
      endsAt = assertUtcIso(scheduledEndAt, 'End time')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Choose valid meeting times', { tone: 'danger' })
      return
    }
    if (Date.parse(endsAt) <= Date.parse(startsAt)) {
      setFieldErrors((current) => ({ ...current, scheduledEndAt: 'End time must be after start time' }))
      toast.show('End time must be after start time', { tone: 'danger' })
      return
    }

    setSaving(true)
    try {
      const meeting = await createMeeting(user.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        scheduledAt: startsAt,
        scheduledEndAt: endsAt,
        timeZone: normalizeIanaTimeZone(timeZone),
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
          recordingMode: !allowRecording ? 'disabled' : autoRecord ? 'automatic' : 'manual',
          captionsEnabled,
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

      const syncResults = await syncMeetingToConnectedCalendars(meeting.id)
      const syncedProviders = syncResults.filter((row) => row.ok).map((row) => row.provider)
      if (syncedProviders.length > 0) {
        toast.show('Added to calendar', {
          tone: 'success',
          message: syncedProviders.map((provider) => calendarProviderLabel(provider)).join(' · '),
        })
      } else {
        const calendarResult = await addMeetingToDeviceCalendar(meeting)
        if (calendarResult === 'saved' || calendarResult === 'opened') {
          toast.show('Meeting added to calendar', { tone: 'success' })
        } else if (calendarResult === 'shared') {
          toast.show('Calendar invite ready (ICS)', { tone: 'success' })
        }
      }

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
          initialPrompt={aiPrompt}
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
            <Field label="Timezone" error={fieldErrors.timeZone || undefined} required>
              <Input
                value={timeZone}
                onChangeText={onTimeZoneChange}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Asia/Kolkata"
                backgroundColor="rgba(255,255,255,0.05)"
                borderColor={fieldErrors.timeZone ? coworkUi.danger : coworkUi.borderSoft}
                color={coworkUi.text}
                borderRadius={14}
              />
              <XStack gap="$2" flexWrap="wrap" marginTop="$2">
                {[resolveDeviceIanaTimeZone(), ...SCHEDULE_TIMEZONE_OPTIONS]
                  .filter((zone, index, all) => all.indexOf(zone) === index)
                  .slice(0, 8)
                  .map((zone) => (
                    <Button
                      key={zone}
                      size="$2"
                      borderRadius={999}
                      tone={timeZone === zone ? 'primary' : 'outline'}
                      borderColor={timeZone === zone ? coworkUi.brand : coworkUi.borderSoft}
                      onPress={() => onTimeZoneChange(zone)}
                    >
                      {zone}
                    </Button>
                  ))}
              </XStack>
              <Text fontSize={12} color={coworkUi.textMuted} marginTop="$2">
                You pick a wall clock in this timezone. Times are stored as UTC; each attendee sees
                them in their own local timezone.
              </Text>
            </Field>
            <ScheduleDateTimeField
              value={scheduledAt}
              timeZone={timeZone}
              onChange={(next) => {
                const previousDuration = Math.max(5 * 60 * 1000, Date.parse(scheduledEndAt) - Date.parse(scheduledAt))
                setScheduledAt(next)
                setScheduledEndAt(new Date(Date.parse(next) + previousDuration).toISOString())
              }}
              label="Starts"
            />
            <ScheduleDateTimeField
              value={scheduledEndAt}
              timeZone={timeZone}
              onChange={setScheduledEndAt}
              label="Ends"
              minDate={new Date(scheduledAt)}
            />
            {fieldErrors.scheduledEndAt ? (
              <Text fontSize={12} color={coworkUi.danger}>{fieldErrors.scheduledEndAt}</Text>
            ) : null}
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

          <CalendarConnectionsPanel redirectTo="/co-work/schedule" />

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
            <ScheduleToggleRow
              label="Allow recording"
              description="Hosts may start a recording during the meeting"
              checked={allowRecording}
              onCheckedChange={(checked) => {
                setAllowRecording(checked)
                if (!checked) setAutoRecord(false)
              }}
            />
            <ScheduleToggleRow
              label="Auto-record"
              description="Start recording when the meeting begins"
              checked={allowRecording && autoRecord}
              onCheckedChange={(checked) => {
                setAllowRecording(checked || allowRecording)
                setAutoRecord(checked)
              }}
            />
            <ScheduleToggleRow
              label="Live captions"
              description="Enable captions for this scheduled meeting"
              checked={captionsEnabled}
              onCheckedChange={setCaptionsEnabled}
            />
            <ScheduleToggleRow label="Raise hand" checked={allowHandRaise} onCheckedChange={setAllowHandRaise} />
            <ScheduleToggleRow
              label="Join before host"
              checked={allowJoinBeforeHost}
              onCheckedChange={setAllowJoinBeforeHost}
            />
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