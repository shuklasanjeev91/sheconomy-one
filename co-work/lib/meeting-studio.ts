import type { MeetingRepeat } from '~/co-work/lib/types'
import type { WhiteboardStroke } from '~/co-work/lib/meeting-whiteboard'

export type MeetingTemplateId = 'mentoring' | 'class' | 'live-selling' | 'circle' | 'office-hours'

export type MeetingAgendaItem = {
  id: string
  title: string
  minutes: number
}

export type MeetingActionItem = {
  id: string
  text: string
  ownerName: string | null
  done: boolean
}

export type MeetingPinnedListing = {
  id: string
  title: string
  href: string
  priceLabel: string | null
}

export type MeetingTimeSlot = {
  id: string
  label: string
  startsAt: string
  voterIds: string[]
}

export type MeetingRegistration = {
  userId: string
  name: string
  status: 'going' | 'waitlist'
}

export type MeetingOfficeEntry = {
  userId: string
  name: string
  joinedAt: number
}

export type MeetingOccurrenceOverride = {
  date: string
  title?: string
  startsAt?: string
  endsAt?: string
}

export type MeetingStudioState = {
  agenda: MeetingAgendaItem[]
  agendaIndex: number
  agendaItemStartedAt: number | null
  sharedNotes: string
  actionItems: MeetingActionItem[]
  stageTimerEndsAt: number | null
  waitingRoomNote: string
  pinnedListing: MeetingPinnedListing | null
  watermarkNames: boolean
  greenRoomOpen: boolean
  speakerIds: string[]
  officeQueue: MeetingOfficeEntry[]
  registrations: MeetingRegistration[]
  registrationCapacity: number | null
  registrationOpen: boolean
  timeSlots: MeetingTimeSlot[]
  coPresenterName: string | null
  allowSecondShare: boolean
  updatedAt: number
}

export type MeetingTemplate = {
  id: MeetingTemplateId
  label: string
  title: string
  description: string
  muteOnJoin: boolean
  videoOffOnJoin: boolean
  captionsEnabled: boolean
  waitingRoom: boolean
  agenda: Array<{ title: string; minutes: number }>
}

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'mentoring',
    label: 'Mentoring',
    title: 'Mentoring session',
    description: 'A 1:1 working session. Camera on, captions on.',
    muteOnJoin: false,
    videoOffOnJoin: false,
    captionsEnabled: true,
    waitingRoom: true,
    agenda: [
      { title: 'Check-in', minutes: 5 },
      { title: 'Working topic', minutes: 20 },
      { title: 'Next steps', minutes: 5 },
    ],
  },
  {
    id: 'class',
    label: 'Class',
    title: 'Class session',
    description: 'Learners stay muted. The host shares the lesson, then opens questions.',
    muteOnJoin: true,
    videoOffOnJoin: true,
    captionsEnabled: true,
    waitingRoom: true,
    agenda: [
      { title: 'Welcome', minutes: 5 },
      { title: 'Lesson', minutes: 25 },
      { title: 'Questions', minutes: 10 },
    ],
  },
  {
    id: 'live-selling',
    label: 'Live selling',
    title: 'Live selling',
    description: 'Pin a product on the stage and keep chat open.',
    muteOnJoin: true,
    videoOffOnJoin: false,
    captionsEnabled: false,
    waitingRoom: false,
    agenda: [
      { title: 'Intro', minutes: 3 },
      { title: 'Product', minutes: 15 },
      { title: 'Questions and offers', minutes: 10 },
    ],
  },
  {
    id: 'circle',
    label: 'Community circle',
    title: 'Community circle',
    description: 'A small group conversation with a shared check-in.',
    muteOnJoin: false,
    videoOffOnJoin: false,
    captionsEnabled: false,
    waitingRoom: true,
    agenda: [
      { title: 'Welcome', minutes: 5 },
      { title: 'Round', minutes: 20 },
      { title: 'Close', minutes: 5 },
    ],
  },
  {
    id: 'office-hours',
    label: 'Office hours',
    title: 'Office hours',
    description: 'A standing room. People wait, and the host admits the next person.',
    muteOnJoin: true,
    videoOffOnJoin: true,
    captionsEnabled: false,
    waitingRoom: true,
    agenda: [{ title: 'Drop-in', minutes: 15 }],
  },
]

const MAX_NOTES = 8_000
const MAX_AGENDA = 24
const MAX_ACTIONS = 40

export function emptyMeetingStudio(): MeetingStudioState {
  return {
    agenda: [],
    agendaIndex: 0,
    agendaItemStartedAt: null,
    sharedNotes: '',
    actionItems: [],
    stageTimerEndsAt: null,
    waitingRoomNote: '',
    pinnedListing: null,
    watermarkNames: false,
    greenRoomOpen: false,
    speakerIds: [],
    officeQueue: [],
    registrations: [],
    registrationCapacity: null,
    registrationOpen: false,
    timeSlots: [],
    coPresenterName: null,
    allowSecondShare: false,
    updatedAt: 0,
  }
}

function asString(value: unknown, max = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function parseMeetingStudio(value: unknown): MeetingStudioState | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const base = emptyMeetingStudio()
  const agenda = Array.isArray(raw.agenda)
    ? raw.agenda
        .map((item, index): MeetingAgendaItem | null => {
          if (!item || typeof item !== 'object') return null
          const row = item as Record<string, unknown>
          const title = asString(row.title, 120)
          if (!title) return null
          const minutes = Number(row.minutes)
          return {
            id: asString(row.id, 80) || `agenda-${index}`,
            title,
            minutes: Number.isFinite(minutes) ? Math.min(180, Math.max(1, Math.round(minutes))) : 5,
          }
        })
        .filter((item): item is MeetingAgendaItem => !!item)
        .slice(0, MAX_AGENDA)
    : []
  const actionItems = Array.isArray(raw.actionItems)
    ? raw.actionItems
        .map((item, index): MeetingActionItem | null => {
          if (!item || typeof item !== 'object') return null
          const row = item as Record<string, unknown>
          const text = asString(row.text, 280)
          if (!text) return null
          const owner = asString(row.ownerName, 80)
          return {
            id: asString(row.id, 80) || `action-${index}`,
            text,
            ownerName: owner || null,
            done: row.done === true,
          }
        })
        .filter((item): item is MeetingActionItem => !!item)
        .slice(0, MAX_ACTIONS)
    : []
  const pinned = raw.pinnedListing
  let pinnedListing: MeetingPinnedListing | null = null
  if (pinned && typeof pinned === 'object') {
    const row = pinned as Record<string, unknown>
    const title = asString(row.title, 160)
    const href = asString(row.href, 400)
    if (title && href) {
      pinnedListing = {
        id: asString(row.id, 80) || 'pin',
        title,
        href,
        priceLabel: asString(row.priceLabel, 40) || null,
      }
    }
  }
  const timeSlots = Array.isArray(raw.timeSlots)
    ? raw.timeSlots
        .map((item, index): MeetingTimeSlot | null => {
          if (!item || typeof item !== 'object') return null
          const row = item as Record<string, unknown>
          const label = asString(row.label, 80)
          const startsAt = asString(row.startsAt, 40)
          if (!label || !startsAt) return null
          const voterIds = Array.isArray(row.voterIds)
            ? row.voterIds.filter((id): id is string => typeof id === 'string').slice(0, 200)
            : []
          return { id: asString(row.id, 80) || `slot-${index}`, label, startsAt, voterIds }
        })
        .filter((item): item is MeetingTimeSlot => !!item)
        .slice(0, 8)
    : []
  const registrations = Array.isArray(raw.registrations)
    ? raw.registrations
        .map((item): MeetingRegistration | null => {
          if (!item || typeof item !== 'object') return null
          const row = item as Record<string, unknown>
          const userId = asString(row.userId, 80)
          const name = asString(row.name, 80)
          if (!userId || !name) return null
          return {
            userId,
            name,
            status: row.status === 'waitlist' ? 'waitlist' : 'going',
          }
        })
        .filter((item): item is MeetingRegistration => !!item)
        .slice(0, 500)
    : []
  const officeQueue = Array.isArray(raw.officeQueue)
    ? raw.officeQueue
        .map((item): MeetingOfficeEntry | null => {
          if (!item || typeof item !== 'object') return null
          const row = item as Record<string, unknown>
          const userId = asString(row.userId, 80)
          const name = asString(row.name, 80)
          const joinedAt = Number(row.joinedAt)
          if (!userId || !name || !Number.isFinite(joinedAt)) return null
          return { userId, name, joinedAt }
        })
        .filter((item): item is MeetingOfficeEntry => !!item)
        .slice(0, 100)
    : []
  const speakerIds = Array.isArray(raw.speakerIds)
    ? raw.speakerIds.filter((id): id is string => typeof id === 'string').slice(0, 50)
    : []
  const capacity = Number(raw.registrationCapacity)
  const timer = Number(raw.stageTimerEndsAt)
  const started = Number(raw.agendaItemStartedAt)
  const index = Number(raw.agendaIndex)
  return {
    ...base,
    agenda,
    agendaIndex: Number.isFinite(index) ? Math.max(0, Math.min(agenda.length, Math.floor(index))) : 0,
    agendaItemStartedAt: Number.isFinite(started) ? started : null,
    sharedNotes: asString(raw.sharedNotes, MAX_NOTES),
    actionItems,
    stageTimerEndsAt: Number.isFinite(timer) ? timer : null,
    waitingRoomNote: asString(raw.waitingRoomNote, 280),
    pinnedListing,
    watermarkNames: raw.watermarkNames === true,
    greenRoomOpen: raw.greenRoomOpen === true,
    speakerIds,
    officeQueue,
    registrations,
    registrationCapacity: Number.isFinite(capacity) && capacity > 0 ? Math.round(capacity) : null,
    registrationOpen: raw.registrationOpen === true,
    timeSlots,
    coPresenterName: asString(raw.coPresenterName, 80) || null,
    allowSecondShare: raw.allowSecondShare === true,
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0,
  }
}

export function mergeMeetingStudio(
  current: MeetingStudioState,
  incoming: MeetingStudioState,
): MeetingStudioState {
  if (incoming.updatedAt >= current.updatedAt) return incoming
  return current
}

export function touchStudio(state: MeetingStudioState, now = Date.now()): MeetingStudioState {
  return { ...state, updatedAt: now }
}

export function meetingTemplateById(id: string | null | undefined): MeetingTemplate | null {
  return MEETING_TEMPLATES.find((template) => template.id === id) ?? null
}

export function agendaFromTemplate(template: MeetingTemplate, now = Date.now()): MeetingAgendaItem[] {
  return template.agenda.map((item, index) => ({
    id: `${template.id}-${index}-${now}`,
    title: item.title,
    minutes: item.minutes,
  }))
}

export function addAgendaItem(
  state: MeetingStudioState,
  title: string,
  minutes: number,
  now = Date.now(),
): MeetingStudioState {
  const cleaned = title.trim().slice(0, 120)
  if (!cleaned || state.agenda.length >= MAX_AGENDA) return state
  return touchStudio(
    {
      ...state,
      agenda: [
        ...state.agenda,
        {
          id: `agenda-${now}-${state.agenda.length}`,
          title: cleaned,
          minutes: Math.min(180, Math.max(1, Math.round(minutes) || 5)),
        },
      ],
    },
    now,
  )
}

export function currentAgendaItem(state: MeetingStudioState): MeetingAgendaItem | null {
  return state.agenda[state.agendaIndex] ?? null
}

export function advanceAgenda(state: MeetingStudioState, now = Date.now()): MeetingStudioState {
  if (!state.agenda.length) return state
  const nextIndex = Math.min(state.agenda.length, state.agendaIndex + 1)
  return touchStudio(
    {
      ...state,
      agendaIndex: nextIndex,
      agendaItemStartedAt: nextIndex < state.agenda.length ? now : null,
    },
    now,
  )
}

export function agendaRemainingMs(state: MeetingStudioState, now = Date.now()): number | null {
  const item = currentAgendaItem(state)
  if (!item || state.agendaItemStartedAt == null) return null
  return Math.max(0, state.agendaItemStartedAt + item.minutes * 60_000 - now)
}

export function formatRemaining(ms: number | null): string | null {
  if (ms == null) return null
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function updateSharedNotes(
  state: MeetingStudioState,
  notes: string,
  now = Date.now(),
): MeetingStudioState {
  return touchStudio({ ...state, sharedNotes: notes.slice(0, MAX_NOTES) }, now)
}

export function addActionItem(
  state: MeetingStudioState,
  text: string,
  ownerName: string | null,
  now = Date.now(),
): MeetingStudioState {
  const cleaned = text.trim().slice(0, 280)
  if (!cleaned || state.actionItems.length >= MAX_ACTIONS) return state
  return touchStudio(
    {
      ...state,
      actionItems: [
        ...state.actionItems,
        {
          id: `action-${now}-${state.actionItems.length}`,
          text: cleaned,
          ownerName: ownerName?.trim() || null,
          done: false,
        },
      ],
    },
    now,
  )
}

export function toggleActionItem(state: MeetingStudioState, id: string, now = Date.now()): MeetingStudioState {
  return touchStudio(
    {
      ...state,
      actionItems: state.actionItems.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    },
    now,
  )
}

/** Pull "Action: …" and "Name will …" lines out of an AI summary. */
export function parseActionItemsFromSummary(summary: string): Array<{ text: string; ownerName: string | null }> {
  const lines = summary
    .split(/\n+/)
    .map((line) => line.replace(/^[\s*\-•\d.)]+/, '').trim())
    .filter(Boolean)
  const items: Array<{ text: string; ownerName: string | null }> = []
  for (const line of lines) {
    const labeled = line.match(/^(?:action|todo|follow[- ]?up)\s*[:\-]\s*(.+)$/i)
    if (labeled?.[1]) {
      items.push(splitOwner(labeled[1]))
      continue
    }
    const named = line.match(/^([A-Z][\w.'-]{1,40})\s+will\s+(.+)$/)
    if (named?.[1] && named[2]) {
      items.push({ ownerName: named[1], text: `${named[1]} will ${named[2]}` })
    }
  }
  return items.slice(0, 12)
}

function splitOwner(text: string): { text: string; ownerName: string | null } {
  const owner = text.match(/^(.+?)\s+[—–-]\s+([A-Z][\w.' -]{1,40})$/)
  if (owner?.[1] && owner[2]) return { text: owner[1].trim(), ownerName: owner[2].trim() }
  return { text: text.trim(), ownerName: null }
}

export function applyParsedActionItems(
  state: MeetingStudioState,
  summary: string,
  now = Date.now(),
): MeetingStudioState {
  let next = state
  for (const item of parseActionItemsFromSummary(summary)) {
    if (next.actionItems.some((existing) => existing.text === item.text)) continue
    next = addActionItem(next, item.text, item.ownerName, now)
  }
  return next
}

export function buildCatchUpPrompt(input: { meetingTitle?: string; transcript: string }): string {
  return [
    'You are catching up someone who just joined this meeting late.',
    'Write 4 short bullets: decisions already made, the topic right now, and what they should do next.',
    'Use only the transcript. If it is thin, say what is still unknown.',
    input.meetingTitle ? `Meeting: ${input.meetingTitle}` : null,
    'Transcript:',
    input.transcript.trim().slice(0, 12_000),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export type AttendanceRow = {
  userId: string
  name: string
  status: string
  joinedAt: string | null
  leftAt: string | null
  durationMinutes: number
  credited: boolean
}

export function buildAttendanceReport(
  participants: Array<{
    userId: string
    name: string
    status: string
    joinedAt: string | null
    leftAt: string | null
  }>,
  now = Date.now(),
  minCreditMinutes = 10,
): AttendanceRow[] {
  return participants
    .filter((row) => row.status === 'admitted' || row.status === 'left' || row.joinedAt)
    .map((row) => {
      const start = row.joinedAt ? Date.parse(row.joinedAt) : Number.NaN
      const end = row.leftAt ? Date.parse(row.leftAt) : now
      const durationMinutes =
        Number.isFinite(start) && Number.isFinite(end) && end >= start
          ? Math.round((end - start) / 60_000)
          : 0
      return {
        userId: row.userId,
        name: row.name,
        status: row.status,
        joinedAt: row.joinedAt,
        leftAt: row.leftAt,
        durationMinutes,
        credited: durationMinutes >= minCreditMinutes && row.status !== 'rejected',
      }
    })
    .sort((a, b) => b.durationMinutes - a.durationMinutes)
}

export function formatAttendanceReport(rows: AttendanceRow[]): string {
  if (!rows.length) return 'No one has joined yet.'
  return rows
    .map((row) => {
      const credit = row.credited ? 'credited' : 'not credited'
      return `${row.name} — ${row.durationMinutes} min (${credit})`
    })
    .join('\n')
}

export function buildMeetingRecap(input: {
  title: string
  summary?: string | null
  actionItems: MeetingActionItem[]
  recordingUrl?: string | null
  attendance?: AttendanceRow[]
}): string {
  const actions = input.actionItems
    .map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}${item.ownerName ? ` — ${item.ownerName}` : ''}`)
    .join('\n')
  const attended = input.attendance?.length
    ? input.attendance.map((row) => `- ${row.name} (${row.durationMinutes} min)`).join('\n')
    : ''
  return [
    input.title.trim() || 'Meeting recap',
    input.summary?.trim() ? `\n${input.summary.trim()}` : '',
    actions ? `\nAction items\n${actions}` : '',
    attended ? `\nAttendance\n${attended}` : '',
    input.recordingUrl ? `\nRecording: ${input.recordingUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function recapMailto(input: { emails: string[]; subject: string; body: string }): string {
  const to = input.emails.filter(Boolean).join(',')
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.body)}`
}

export function communityRecapPost(input: { title: string; body: string }): string {
  return `${input.title.trim() || 'Meeting recap'}\n\n${input.body.trim()}`
}

export function startStageTimer(state: MeetingStudioState, minutes: number, now = Date.now()): MeetingStudioState {
  const span = Math.min(180, Math.max(1, Math.round(minutes) || 1))
  return touchStudio({ ...state, stageTimerEndsAt: now + span * 60_000 }, now)
}

export function clearStageTimer(state: MeetingStudioState, now = Date.now()): MeetingStudioState {
  return touchStudio({ ...state, stageTimerEndsAt: null }, now)
}

export function stageTimerRemainingMs(state: MeetingStudioState, now = Date.now()): number | null {
  if (state.stageTimerEndsAt == null) return null
  return Math.max(0, state.stageTimerEndsAt - now)
}

export function updateHandQueue(order: string[], userId: string, raised: boolean): string[] {
  const without = order.filter((id) => id !== userId)
  return raised ? [...without, userId] : without
}

export function handQueueLabel(order: string[], userId: string): string | null {
  const index = order.indexOf(userId)
  if (index < 0) return null
  if (index === 0) return "You're next"
  return `${index + 1} in queue`
}

export function registerForMeeting(
  state: MeetingStudioState,
  person: { userId: string; name: string },
  now = Date.now(),
): MeetingStudioState {
  if (!state.registrationOpen) return state
  if (state.registrations.some((row) => row.userId === person.userId)) return state
  const going = state.registrations.filter((row) => row.status === 'going').length
  const capacity = state.registrationCapacity
  const status = capacity != null && going >= capacity ? 'waitlist' : 'going'
  return touchStudio(
    {
      ...state,
      registrations: [...state.registrations, { userId: person.userId, name: person.name, status }],
    },
    now,
  )
}

export function voteTimeSlot(
  state: MeetingStudioState,
  slotId: string,
  userId: string,
  now = Date.now(),
): MeetingStudioState {
  return touchStudio(
    {
      ...state,
      timeSlots: state.timeSlots.map((slot) => {
        if (slot.id !== slotId) return slot
        const has = slot.voterIds.includes(userId)
        return {
          ...slot,
          voterIds: has ? slot.voterIds.filter((id) => id !== userId) : [...slot.voterIds, userId],
        }
      }),
    },
    now,
  )
}

export function winningTimeSlot(slots: MeetingTimeSlot[]): MeetingTimeSlot | null {
  return [...slots].sort((a, b) => b.voterIds.length - a.voterIds.length)[0] ?? null
}

export function joinOfficeQueue(
  state: MeetingStudioState,
  person: { userId: string; name: string },
  now = Date.now(),
): MeetingStudioState {
  if (state.officeQueue.some((row) => row.userId === person.userId)) return state
  return touchStudio(
    {
      ...state,
      officeQueue: [...state.officeQueue, { userId: person.userId, name: person.name, joinedAt: now }],
    },
    now,
  )
}

export function admitNextOffice(state: MeetingStudioState, now = Date.now()): {
  state: MeetingStudioState
  next: MeetingOfficeEntry | null
} {
  const [next, ...rest] = state.officeQueue
  return {
    next: next ?? null,
    state: touchStudio({ ...state, officeQueue: rest }, now),
  }
}

export function canEnterFromGreenRoom(input: {
  greenRoomOpen: boolean
  isSpeaker: boolean
  canModerate: boolean
}): boolean {
  if (!input.greenRoomOpen) return true
  return input.canModerate || input.isSpeaker
}

export function watermarkLabel(name: string): string {
  const cleaned = name.trim() || 'Participant'
  return `${cleaned} · SHEconomy`
}

export function secondShareDecision(input: {
  activeSharerId: string | null
  requesterId: string
  allowSecond: boolean
}): 'primary' | 'co-presenter' | 'queued' {
  if (!input.activeSharerId || input.activeSharerId === input.requesterId) return 'primary'
  return input.allowSecond ? 'co-presenter' : 'queued'
}

export function assignParticipantsToTopics(input: {
  participants: Array<{ userId: string; topic: string }>
  topics: string[]
}): Array<{ topic: string; userIds: string[] }> {
  const topics = input.topics.map((topic) => topic.trim()).filter(Boolean)
  const groups = topics.map((topic) => ({ topic, userIds: [] as string[] }))
  const extra: string[] = []
  for (const person of input.participants) {
    const topic = person.topic.trim().toLowerCase()
    const match = groups.find((group) => group.topic.toLowerCase() === topic)
    if (match) match.userIds.push(person.userId)
    else extra.push(person.userId)
  }
  if (extra.length && groups.length) {
    extra.forEach((userId, index) => {
      groups[index % groups.length]?.userIds.push(userId)
    })
  }
  return groups
}

export type PollExportRow = {
  question: string
  status: string
  options: Array<{ text: string; votes: number }>
}

export function formatPollExport(polls: PollExportRow[]): string {
  if (!polls.length) return 'No polls.'
  return polls
    .map((poll) => {
      const options = poll.options.map((option) => `- ${option.text}: ${option.votes}`).join('\n')
      return `${poll.question} (${poll.status})\n${options}`
    })
    .join('\n\n')
}

export type QaExportRow = { body: string; status: string; votes: number; asker: string }

export function formatQaExport(questions: QaExportRow[]): string {
  if (!questions.length) return 'No questions.'
  return questions
    .map((question) => `- [${question.status}] ${question.body} — ${question.asker} (${question.votes})`)
    .join('\n')
}

export function extractChatMentions(text: string): string[] {
  const found = text.match(/@([A-Za-z0-9_.-]{2,32})/g) ?? []
  return [...new Set(found.map((token) => token.slice(1)))]
}

export function splitChatReply(text: string): { replyTo: string | null; body: string } {
  const match = text.match(/^↩\s+([^:\n]{1,80}):\s+([^\n]{0,80})\n([\s\S]*)$/)
  if (!match) return { replyTo: null, body: text }
  return { replyTo: `${match[1]}: ${match[2]}`.trim(), body: (match[3] ?? '').trim() || text }
}

export function formatChatReply(input: { name: string; snippet: string; body: string }): string {
  const snippet = input.snippet.replace(/\s+/g, ' ').trim().slice(0, 80)
  return `↩ ${input.name.trim() || 'Someone'}: ${snippet}\n${input.body.trim()}`
}

const DAY = 24 * 60 * 60 * 1000

function addRepeat(date: Date, repeat: MeetingRepeat, steps: number): Date {
  const next = new Date(date.getTime())
  if (repeat === 'daily') next.setUTCDate(next.getUTCDate() + steps)
  else if (repeat === 'weekly') next.setUTCDate(next.getUTCDate() + steps * 7)
  else if (repeat === 'monthly') next.setUTCMonth(next.getUTCMonth() + steps)
  return next
}

function dayKey(iso: string): string {
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return ''
  return new Date(parsed).toISOString().slice(0, 10)
}

export function nextSeriesOccurrence(
  input: {
    scheduledAt: string | null
    repeat: MeetingRepeat
    skippedDates?: string[]
  },
  now = Date.now(),
): string | null {
  if (!input.scheduledAt || !input.repeat) return input.scheduledAt
  const start = Date.parse(input.scheduledAt)
  if (!Number.isFinite(start)) return null
  const skipped = new Set((input.skippedDates ?? []).map((date) => date.slice(0, 10)))
  for (let step = 0; step < 370; step += 1) {
    const when = addRepeat(new Date(start), input.repeat, step)
    const key = when.toISOString().slice(0, 10)
    if (when.getTime() + DAY < now) continue
    if (skipped.has(key)) continue
    return when.toISOString()
  }
  return null
}

export function displayOccurrence(
  meeting: {
    title: string
    scheduled_at: string | null
    scheduled_end_at?: string | null
    repeat?: MeetingRepeat
    is_recurring?: boolean | null
    meeting_options?: {
      skippedDates?: string[]
      occurrenceOverrides?: MeetingOccurrenceOverride[]
    } | null
  },
  now = Date.now(),
): { title: string; startsAt: string | null; endsAt: string | null } {
  const startsAt = meeting.is_recurring || meeting.repeat
    ? nextSeriesOccurrence(
        {
          scheduledAt: meeting.scheduled_at,
          repeat: meeting.repeat ?? null,
          skippedDates: meeting.meeting_options?.skippedDates,
        },
        now,
      )
    : meeting.scheduled_at
  const key = startsAt ? dayKey(startsAt) : ''
  const override = (meeting.meeting_options?.occurrenceOverrides ?? []).find((row) => row.date === key)
  return {
    title: override?.title?.trim() || meeting.title,
    startsAt: override?.startsAt || startsAt,
    endsAt: override?.endsAt || meeting.scheduled_end_at || null,
  }
}

export function withSkippedDate(dates: string[] | undefined, iso: string): string[] {
  const key = dayKey(iso)
  if (!key) return dates ?? []
  return [...new Set([...(dates ?? []), key])]
}

export function whiteboardTemplateStrokes(
  kind: 'canvas' | 'swot' | 'pricing',
  userId: string,
  now = Date.now(),
): WhiteboardStroke[] {
  const labels =
    kind === 'swot'
      ? [
          { text: 'Strengths', x: 0.08, y: 0.12 },
          { text: 'Weaknesses', x: 0.52, y: 0.12 },
          { text: 'Opportunities', x: 0.08, y: 0.52 },
          { text: 'Threats', x: 0.52, y: 0.52 },
        ]
      : kind === 'pricing'
        ? [
            { text: 'Cost', x: 0.08, y: 0.16 },
            { text: 'Price', x: 0.4, y: 0.16 },
            { text: 'Offer', x: 0.7, y: 0.16 },
          ]
        : [
            { text: 'Customers', x: 0.08, y: 0.14 },
            { text: 'Offer', x: 0.4, y: 0.14 },
            { text: 'Channels', x: 0.7, y: 0.14 },
            { text: 'Costs', x: 0.2, y: 0.55 },
            { text: 'Revenue', x: 0.58, y: 0.55 },
          ]
  return labels.map((label, index) => ({
    id: `${kind}-${userId}-${now}-${index}`,
    from: userId,
    tool: 'text' as const,
    color: '#1f2937',
    width: 2,
    points: [{ x: label.x, y: label.y }],
    text: label.text,
  }))
}
