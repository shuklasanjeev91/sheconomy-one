import { useState } from 'react'

import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { CoWorkPanelShell, CoWorkSectionLabel } from '~/co-work/components/CoWorkUi'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import {
  addActionItem,
  addAgendaItem,
  admitNextOffice,
  advanceAgenda,
  applyParsedActionItems,
  buildAttendanceReport,
  buildMeetingRecap,
  clearStageTimer,
  communityRecapPost,
  currentAgendaItem,
  formatAttendanceReport,
  formatRemaining,
  agendaRemainingMs,
  joinOfficeQueue,
  recapMailto,
  registerForMeeting,
  stageTimerRemainingMs,
  startStageTimer,
  toggleActionItem,
  updateSharedNotes,
  watermarkLabel,
  voteTimeSlot,
  winningTimeSlot,
  type AttendanceRow,
  type MeetingStudioState,
} from '~/co-work/lib/meeting-studio'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import type { MeetingParticipant } from '~/co-work/lib/types'
import { Button, Field, Icons, Input, ScrollView, Text, TextArea, XStack, YStack, useAppToast } from '~/components/ui'
import { Linking, Platform } from 'react-native'

type StudioTab = 'agenda' | 'notes' | 'actions' | 'room' | 'after'

type MeetingStudioPanelProps = {
  meetingTitle: string
  userId: string
  displayName: string
  canModerate: boolean
  studio: MeetingStudioState
  participants: MeetingParticipant[]
  transcriptText?: string
  inviteEmails?: string[]
  onChange: (next: MeetingStudioState) => void
  onAdmitUser?: (userId: string) => void
  onClose: () => void
  fullWidth?: boolean
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const { ui } = useCoWorkTheme()
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? ui.brand : ui.surfaceMuted,
      }}
    >
      <Text fontSize={12} fontWeight="700" color={active ? '#fff' : ui.text}>
        {label}
      </Text>
    </Pressable>
  )
}

export function MeetingStudioPanel({
  meetingTitle,
  userId,
  displayName,
  canModerate,
  studio,
  participants,
  transcriptText = '',
  inviteEmails = [],
  onChange,
  onAdmitUser,
  onClose,
  fullWidth,
}: MeetingStudioPanelProps) {
  const { ui } = useCoWorkTheme()
  const toast = useAppToast()
  const [tab, setTab] = useState<StudioTab>('agenda')
  const [topic, setTopic] = useState('')
  const [minutes, setMinutes] = useState('5')
  const [actionText, setActionText] = useState('')
  const [owner, setOwner] = useState('')
  const [pinTitle, setPinTitle] = useState(studio.pinnedListing?.title ?? '')
  const [pinHref, setPinHref] = useState(studio.pinnedListing?.href ?? '')
  const [pinPrice, setPinPrice] = useState(studio.pinnedListing?.priceLabel ?? '')
  const [slotLabel, setSlotLabel] = useState('')
  const [catchUp, setCatchUp] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)

  const item = currentAgendaItem(studio)
  const attendance: AttendanceRow[] = buildAttendanceReport(
    participants.map((row) => ({
      userId: row.user_id,
      name: row.display_name || row.profile?.full_name || row.profile?.username || 'Participant',
      status: row.status,
      joinedAt: row.joined_at,
      leftAt: row.left_at,
    })),
  )

  async function copyText(label: string, text: string) {
    const { copyMeetingTranscriptText } = await import('~/co-work/lib/meeting-transcript-archive')
    const copied = await copyMeetingTranscriptText(text)
    toast.show(copied ? `${label} copied` : label, { tone: copied ? 'success' : 'info', message: text.slice(0, 180) })
  }

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Meeting studio"
        subtitle="Agenda, notes, and follow-up"
        icon={<Icons.Sparkles size={18} color={ui.brandLight} />}
        onClose={onClose}
      />
      <ScrollView flex={1} padding="$3">
        <YStack gap="$3">
          <XStack gap="$2" flexWrap="wrap">
            <TabButton label="Agenda" active={tab === 'agenda'} onPress={() => setTab('agenda')} />
            <TabButton label="Notes" active={tab === 'notes'} onPress={() => setTab('notes')} />
            <TabButton label="Actions" active={tab === 'actions'} onPress={() => setTab('actions')} />
            <TabButton label="Room" active={tab === 'room'} onPress={() => setTab('room')} />
            <TabButton label="After" active={tab === 'after'} onPress={() => setTab('after')} />
          </XStack>

          {tab === 'agenda' ? (
            <YStack gap="$3">
              <CoWorkSectionLabel>Live agenda</CoWorkSectionLabel>
              {item ? (
                <YStack gap="$1" padding="$3" borderRadius={12} backgroundColor={ui.surfaceMuted}>
                  <Text fontWeight="800" color={ui.text}>
                    Now: {item.title}
                  </Text>
                  <Text fontSize={12} color={ui.textMuted}>
                    {formatRemaining(agendaRemainingMs(studio)) ?? `${item.minutes} min`}
                  </Text>
                </YStack>
              ) : (
                <Text fontSize={13} color={ui.textMuted}>
                  {studio.agenda.length ? 'Agenda finished.' : 'Add topics the room can follow.'}
                </Text>
              )}
              {studio.agenda.map((row, index) => (
                <Text key={row.id} fontSize={13} color={index === studio.agendaIndex ? ui.brandLight : ui.text}>
                  {index + 1}. {row.title} · {row.minutes} min
                </Text>
              ))}
              {canModerate ? (
                <YStack gap="$2">
                  <Field label="Topic">
                    <Input value={topic} onChangeText={setTopic} placeholder="Lesson, pitch, questions" color={ui.text} />
                  </Field>
                  <Field label="Minutes">
                    <Input value={minutes} onChangeText={setMinutes} keyboardType="number-pad" color={ui.text} />
                  </Field>
                  <XStack gap="$2" flexWrap="wrap">
                    <Button
                      tone="primary"
                      size="$2"
                      borderRadius={12}
                      onPress={() => {
                        onChange(addAgendaItem(studio, topic, Number(minutes) || 5))
                        setTopic('')
                      }}
                    >
                      Add
                    </Button>
                    <Button tone="outline" size="$2" borderRadius={12} onPress={() => onChange(advanceAgenda(studio))}>
                      Next topic
                    </Button>
                    <Button
                      tone="outline"
                      size="$2"
                      borderRadius={12}
                      onPress={() => onChange(startStageTimer(studio, Number(minutes) || 3))}
                    >
                      Start timer
                    </Button>
                    <Button tone="ghost" size="$2" onPress={() => onChange(clearStageTimer(studio))}>
                      Clear timer
                    </Button>
                  </XStack>
                  {studio.stageTimerEndsAt ? (
                    <Text fontSize={12} color={ui.textMuted}>
                      Stage timer {formatRemaining(stageTimerRemainingMs(studio)) ?? 'done'}
                    </Text>
                  ) : null}
                </YStack>
              ) : null}
            </YStack>
          ) : null}

          {tab === 'notes' ? (
            <YStack gap="$2">
              <CoWorkSectionLabel>Shared notes</CoWorkSectionLabel>
              <Text fontSize={12} color={ui.textMuted}>
                Everyone in the room sees these. Your private notes stay in My Notes.
              </Text>
              <TextArea
                value={studio.sharedNotes}
                onChangeText={(value) => onChange(updateSharedNotes(studio, value))}
                placeholder="Decisions and context for the whole room"
                minHeight={220}
                color={ui.text}
                borderColor={ui.borderSoft}
              />
            </YStack>
          ) : null}

          {tab === 'actions' ? (
            <YStack gap="$3">
              <CoWorkSectionLabel>Action items</CoWorkSectionLabel>
              {studio.actionItems.map((action) => (
                <XStack key={action.id} gap="$2" alignItems="center">
                  <Button tone="ghost" size="$2" onPress={() => onChange(toggleActionItem(studio, action.id))}>
                    {action.done ? 'Done' : 'Open'}
                  </Button>
                  <Text flex={1} fontSize={13} color={action.done ? ui.textMuted : ui.text}>
                    {action.text}
                    {action.ownerName ? ` — ${action.ownerName}` : ''}
                  </Text>
                </XStack>
              ))}
              <Field label="Task">
                <Input value={actionText} onChangeText={setActionText} placeholder="Send the recap" color={ui.text} />
              </Field>
              <Field label="Owner">
                <Input value={owner} onChangeText={setOwner} placeholder="Optional name" color={ui.text} />
              </Field>
              <XStack gap="$2">
                <Button
                  tone="primary"
                  size="$2"
                  borderRadius={12}
                  onPress={() => {
                    onChange(addActionItem(studio, actionText, owner || null))
                    setActionText('')
                  }}
                >
                  Add task
                </Button>
                <Button
                  tone="outline"
                  size="$2"
                  borderRadius={12}
                  disabled={busy}
                  onPress={() => {
                    const pasted = summary.trim()
                    if (pasted) {
                      onChange(applyParsedActionItems(studio, pasted))
                      return
                    }
                    if (!transcriptText.trim()) {
                      toast.show('Turn on captions or paste a summary', { tone: 'info' })
                      return
                    }
                    setBusy(true)
                    void (async () => {
                      const { summarizeMeetingTranscript } = await import('~/co-work/lib/meeting-ai-summary')
                      const nextSummary = await summarizeMeetingTranscript({
                        meetingTitle,
                        transcript: transcriptText,
                      })
                      setSummary(nextSummary)
                      onChange(applyParsedActionItems(studio, nextSummary))
                    })()
                      .catch((cause) =>
                        toast.show('Could not read actions', {
                          tone: 'danger',
                          message: cause instanceof Error ? cause.message : undefined,
                        }),
                      )
                      .finally(() => setBusy(false))
                  }}
                >
                  From summary
                </Button>
              </XStack>
              <Field label="Paste a summary">
                <TextArea
                  value={summary}
                  onChangeText={setSummary}
                  placeholder="Action: Send the deck — Ada"
                  minHeight={80}
                  color={ui.text}
                />
              </Field>
              <Button
                tone="outline"
                size="$2"
                borderRadius={12}
                onPress={() => onChange(applyParsedActionItems(studio, summary))}
              >
                Save pasted actions
              </Button>
            </YStack>
          ) : null}

          {tab === 'room' ? (
            <YStack gap="$3">
              <CoWorkSectionLabel>Waiting room note</CoWorkSectionLabel>
              {canModerate ? (
                <TextArea
                  value={studio.waitingRoomNote}
                  onChangeText={(value) => onChange({ ...studio, waitingRoomNote: value, updatedAt: Date.now() })}
                  placeholder="We'll start with intros"
                  minHeight={70}
                  color={ui.text}
                />
              ) : (
                <Text fontSize={13} color={ui.text}>
                  {studio.waitingRoomNote || 'No note from the host.'}
                </Text>
              )}

              <CoWorkSectionLabel>Pinned listing</CoWorkSectionLabel>
              {studio.pinnedListing ? (
                <Text fontSize={13} color={ui.text}>
                  {studio.pinnedListing.title}
                  {studio.pinnedListing.priceLabel ? ` · ${studio.pinnedListing.priceLabel}` : ''}
                </Text>
              ) : null}
              {canModerate ? (
                <YStack gap="$2">
                  <Input value={pinTitle} onChangeText={setPinTitle} placeholder="Product name" color={ui.text} />
                  <Input value={pinHref} onChangeText={setPinHref} placeholder="https://…" color={ui.text} />
                  <Input value={pinPrice} onChangeText={setPinPrice} placeholder="Price" color={ui.text} />
                  <Button
                    tone="primary"
                    size="$2"
                    borderRadius={12}
                    onPress={() =>
                      onChange({
                        ...studio,
                        updatedAt: Date.now(),
                        pinnedListing:
                          pinTitle.trim() && pinHref.trim()
                            ? {
                                id: studio.pinnedListing?.id || `pin-${Date.now()}`,
                                title: pinTitle.trim(),
                                href: pinHref.trim(),
                                priceLabel: pinPrice.trim() || null,
                              }
                            : null,
                      })
                    }
                  >
                    Pin on stage
                  </Button>
                </YStack>
              ) : null}

              <CoWorkSectionLabel>Find a time</CoWorkSectionLabel>
              {studio.timeSlots.map((slot) => (
                <XStack key={slot.id} alignItems="center" justifyContent="space-between">
                  <Text fontSize={13} color={ui.text}>
                    {slot.label} · {slot.voterIds.length}
                  </Text>
                  <Button tone="ghost" size="$2" onPress={() => onChange(voteTimeSlot(studio, slot.id, userId))}>
                    {slot.voterIds.includes(userId) ? 'Remove vote' : 'Vote'}
                  </Button>
                </XStack>
              ))}
              {winningTimeSlot(studio.timeSlots) ? (
                <Text fontSize={12} color={ui.textMuted}>
                  Leading: {winningTimeSlot(studio.timeSlots)?.label}
                </Text>
              ) : null}
              {canModerate ? (
                <XStack gap="$2">
                  <Input flex={1} value={slotLabel} onChangeText={setSlotLabel} placeholder="Tue 10:00" color={ui.text} />
                  <Button
                    tone="outline"
                    size="$2"
                    onPress={() => {
                      const label = slotLabel.trim()
                      if (!label) return
                      onChange({
                        ...studio,
                        updatedAt: Date.now(),
                        timeSlots: [
                          ...studio.timeSlots,
                          { id: `slot-${Date.now()}`, label, startsAt: label, voterIds: [] },
                        ].slice(0, 8),
                      })
                      setSlotLabel('')
                    }}
                  >
                    Add slot
                  </Button>
                </XStack>
              ) : null}

              <CoWorkSectionLabel>Registration</CoWorkSectionLabel>
              <Text fontSize={12} color={ui.textMuted}>
                {studio.registrations.filter((row) => row.status === 'going').length} going
                {studio.registrationCapacity ? ` · ${studio.registrationCapacity} seats` : ''}
              </Text>
              {canModerate ? (
                <Button
                  tone="outline"
                  size="$2"
                  borderRadius={12}
                  onPress={() =>
                    onChange({
                      ...studio,
                      updatedAt: Date.now(),
                      registrationOpen: !studio.registrationOpen,
                      registrationCapacity: studio.registrationCapacity ?? 50,
                    })
                  }
                >
                  {studio.registrationOpen ? 'Close registration' : 'Open registration'}
                </Button>
              ) : null}
              <Button
                tone="primary"
                size="$2"
                borderRadius={12}
                onPress={() => onChange(registerForMeeting(studio, { userId, name: displayName }))}
              >
                I'm going
              </Button>

              <CoWorkSectionLabel>Office hours</CoWorkSectionLabel>
              {studio.officeQueue.map((entry, index) => (
                <Text key={entry.userId} fontSize={13} color={ui.text}>
                  {index + 1}. {entry.name}
                </Text>
              ))}
              <XStack gap="$2">
                <Button
                  tone="outline"
                  size="$2"
                  borderRadius={12}
                  onPress={() => onChange(joinOfficeQueue(studio, { userId, name: displayName }))}
                >
                  Join queue
                </Button>
                {canModerate ? (
                  <Button
                    tone="primary"
                    size="$2"
                    borderRadius={12}
                    onPress={() => {
                      const admitted = admitNextOffice(studio)
                      onChange(admitted.state)
                      if (admitted.next) onAdmitUser?.(admitted.next.userId)
                      toast.show(admitted.next ? `Next: ${admitted.next.name}` : 'Queue is empty', { tone: 'info' })
                    }}
                  >
                    Admit next
                  </Button>
                ) : null}
              </XStack>

              {canModerate ? (
                <YStack gap="$2">
                  <CoWorkSectionLabel>Green room and share</CoWorkSectionLabel>
                  <Button
                    tone="outline"
                    size="$2"
                    borderRadius={12}
                    onPress={() =>
                      onChange({ ...studio, greenRoomOpen: !studio.greenRoomOpen, updatedAt: Date.now() })
                    }
                  >
                    {studio.greenRoomOpen ? 'Open the room to everyone' : 'Hold attendees in the green room'}
                  </Button>
                  <Button
                    tone="outline"
                    size="$2"
                    borderRadius={12}
                    onPress={() =>
                      onChange({ ...studio, watermarkNames: !studio.watermarkNames, updatedAt: Date.now() })
                    }
                  >
                    {studio.watermarkNames ? 'Hide screen watermark' : 'Watermark shared screens'}
                  </Button>
                  <Button
                    tone="outline"
                    size="$2"
                    borderRadius={12}
                    onPress={() =>
                      onChange({
                        ...studio,
                        allowSecondShare: !studio.allowSecondShare,
                        coPresenterName: studio.allowSecondShare ? null : studio.coPresenterName,
                        updatedAt: Date.now(),
                      })
                    }
                  >
                    {studio.allowSecondShare ? 'One presenter only' : 'Allow a second presenter'}
                  </Button>
                </YStack>
              ) : null}
            </YStack>
          ) : null}

          {tab === 'after' ? (
            <YStack gap="$3">
              <CoWorkSectionLabel>Catch me up</CoWorkSectionLabel>
              <Button
                tone="primary"
                size="$2"
                borderRadius={12}
                disabled={busy}
                onPress={() => {
                  setBusy(true)
                  void (async () => {
                    const { catchUpMeeting } = await import('~/co-work/lib/meeting-catch-up')
                    const text = await catchUpMeeting({
                      meetingTitle,
                      transcript: transcriptText,
                    })
                    setCatchUp(text)
                  })()
                    .catch((cause) =>
                      toast.show('Could not catch you up', {
                        tone: 'danger',
                        message: cause instanceof Error ? cause.message : undefined,
                      }),
                    )
                    .finally(() => setBusy(false))
                }}
              >
                Catch me up
              </Button>
              {catchUp ? (
                <Text fontSize={13} color={ui.text} lineHeight={20}>
                  {catchUp}
                </Text>
              ) : (
                <Text fontSize={12} color={ui.textMuted}>
                  Uses the live transcript. Turn captions on so there is something to summarize.
                </Text>
              )}

              <CoWorkSectionLabel>Attendance</CoWorkSectionLabel>
              {attendance.map((row) => (
                <Text key={row.userId} fontSize={13} color={ui.text}>
                  {row.name} · {row.durationMinutes} min{row.credited ? ' · class credit' : ''}
                </Text>
              ))}
              <Button
                tone="outline"
                size="$2"
                borderRadius={12}
                onPress={() => void copyText('Attendance', formatAttendanceReport(attendance))}
              >
                Copy attendance
              </Button>

              <CoWorkSectionLabel>Follow-up</CoWorkSectionLabel>
              <Button
                tone="outline"
                size="$2"
                borderRadius={12}
                onPress={() => {
                  const body = buildMeetingRecap({
                    title: meetingTitle,
                    summary: summary || catchUp,
                    actionItems: studio.actionItems,
                    attendance,
                  })
                  const href = recapMailto({
                    emails: inviteEmails,
                    subject: `Recap: ${meetingTitle}`,
                    body,
                  })
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.location.href = href
                  } else {
                    void Linking.openURL(href)
                  }
                }}
              >
                Email recap
              </Button>
              <Button
                tone="outline"
                size="$2"
                borderRadius={12}
                onPress={() =>
                  void (async () => {
                  const body = communityRecapPost({
                    title: meetingTitle,
                    body: buildMeetingRecap({
                      title: meetingTitle,
                      summary: summary || catchUp,
                      actionItems: studio.actionItems,
                      attendance,
                    }),
                  })
                  const { createCommunityPost } = await import('~/community/lib/community')
                  const result = await createCommunityPost(userId, { content: body })
                  if (result.error) {
                    await copyText('Community post', body)
                    return
                  }
                  toast.show('Recap posted to your community', { tone: 'success' })
                })()
                }
              >
                Post recap to community
              </Button>
            </YStack>
          ) : null}
        </YStack>
      </ScrollView>
    </CoWorkPanelShell>
  )
}

export function MeetingStudioBanner({
  studio,
  viewerName,
}: {
  studio: MeetingStudioState
  viewerName?: string
}) {
  const { ui } = useCoWorkTheme()
  const item = currentAgendaItem(studio)
  const agendaLeft = formatRemaining(agendaRemainingMs(studio))
  const timerLeft = formatRemaining(stageTimerRemainingMs(studio))
  const pin = studio.pinnedListing
  if (!item && !timerLeft && !pin && !studio.coPresenterName && !studio.watermarkNames) return null
  return (
    <XStack
      pointerEvents="none"
      alignItems="center"
      justifyContent="center"
      gap="$2"
      paddingHorizontal="$3"
      paddingVertical="$1.5"
      flexWrap="wrap"
    >
      {item ? (
        <Text fontSize={12} fontWeight="700" color={ui.text}>
          {item.title}
          {agendaLeft ? ` · ${agendaLeft}` : ''}
        </Text>
      ) : null}
      {timerLeft ? (
        <Text fontSize={12} fontWeight="700" color={ui.brandLight}>
          Timer {timerLeft}
        </Text>
      ) : null}
      {pin ? (
        <Text fontSize={12} fontWeight="700" color={ui.text}>
          {pin.title}
          {pin.priceLabel ? ` · ${pin.priceLabel}` : ''}
        </Text>
      ) : null}
      {studio.coPresenterName ? (
        <Text fontSize={12} color={ui.textMuted}>
          Also presenting: {studio.coPresenterName}
        </Text>
      ) : null}
      {studio.watermarkNames && viewerName ? (
        <Text fontSize={11} color={ui.textMuted}>
          {watermarkLabel(viewerName)}
        </Text>
      ) : null}
    </XStack>
  )
}

export function MeetingGreenRoomHold({
  title,
  onLeave,
}: {
  title: string
  onLeave: () => void
}) {
  const { ui } = useCoWorkTheme()
  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={40}
      alignItems="center"
      justifyContent="center"
      padding="$5"
      backgroundColor={ui.pageBg}
      gap="$3"
    >
      <Text fontSize={22} fontWeight="800" color={ui.text} textAlign="center">
        Green room
      </Text>
      <Text fontSize={14} color={ui.textSecondary} textAlign="center">
        {title} will open for everyone when the host is ready. The host and co-hosts are already inside.
      </Text>
      <Button tone="outline" borderRadius={12} onPress={onLeave}>
        Leave
      </Button>
    </YStack>
  )
}
