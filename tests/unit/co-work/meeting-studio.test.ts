import { describe, expect, it } from 'vitest'

import {
  addAgendaItem,
  advanceAgenda,
  agendaRemainingMs,
  applyParsedActionItems,
  assignParticipantsToTopics,
  buildAttendanceReport,
  buildMeetingRecap,
  canEnterFromGreenRoom,
  displayOccurrence,
  emptyMeetingStudio,
  extractChatMentions,
  formatChatReply,
  formatPollExport,
  handQueueLabel,
  mergeMeetingStudio,
  nextSeriesOccurrence,
  parseActionItemsFromSummary,
  registerForMeeting,
  secondShareDecision,
  splitChatReply,
  updateHandQueue,
  whiteboardTemplateStrokes,
  winningTimeSlot,
} from '~/co-work/lib/meeting-studio'

describe('meeting studio', () => {
  it('advances a timed agenda', () => {
    const started = addAgendaItem(emptyMeetingStudio(), 'Lesson', 10, 1_000)
    const running = { ...started, agendaItemStartedAt: 1_000 }
    expect(agendaRemainingMs(running, 1_000 + 60_000)).toBe(9 * 60_000)
    const next = advanceAgenda(running, 2_000)
    expect(next.agendaIndex).toBe(1)
    expect(next.agenda[0]?.title).toBe('Lesson')
  })

  it('parses owners out of a summary and builds a recap', () => {
    const parsed = parseActionItemsFromSummary('Action: Send the deck — Ada\nBea will book the room')
    expect(parsed[0]).toEqual({ text: 'Send the deck', ownerName: 'Ada' })
    expect(parsed[1]?.ownerName).toBe('Bea')
    const studio = applyParsedActionItems(emptyMeetingStudio(), 'Action: Send the deck — Ada', 5)
    const recap = buildMeetingRecap({
      title: 'Class',
      summary: 'We shipped the outline.',
      actionItems: studio.actionItems,
    })
    expect(recap).toContain('Send the deck')
    expect(recap).toContain('Ada')
  })

  it('credits attendance after the minimum time', () => {
    const rows = buildAttendanceReport(
      [
        {
          userId: 'a',
          name: 'Ada',
          status: 'admitted',
          joinedAt: '2026-10-16T10:00:00.000Z',
          leftAt: null,
        },
        {
          userId: 'b',
          name: 'Bea',
          status: 'left',
          joinedAt: '2026-10-16T10:50:00.000Z',
          leftAt: '2026-10-16T10:55:00.000Z',
        },
      ],
      Date.parse('2026-10-16T10:20:00.000Z'),
      10,
    )
    expect(rows.find((row) => row.userId === 'a')?.credited).toBe(true)
    expect(rows.find((row) => row.userId === 'b')?.credited).toBe(false)
  })

  it('waitlists a registration once capacity is full', () => {
    const open = {
      ...emptyMeetingStudio(),
      registrationOpen: true,
      registrationCapacity: 1,
    }
    const first = registerForMeeting(open, { userId: 'a', name: 'Ada' }, 1)
    const second = registerForMeeting(first, { userId: 'b', name: 'Bea' }, 2)
    expect(second.registrations.map((row) => row.status)).toEqual(['going', 'waitlist'])
  })

  it('keeps a stable hand queue', () => {
    const order = updateHandQueue(updateHandQueue([], 'a', true), 'b', true)
    expect(handQueueLabel(order, 'a')).toBe("You're next")
    expect(handQueueLabel(updateHandQueue(order, 'a', false), 'b')).toBe("You're next")
  })

  it('skips one date and still shows the series', () => {
    const next = nextSeriesOccurrence(
      {
        scheduledAt: '2026-10-16T09:00:00.000Z',
        repeat: 'weekly',
        skippedDates: ['2026-10-16'],
      },
      Date.parse('2026-10-16T08:00:00.000Z'),
    )
    expect(next?.slice(0, 10)).toBe('2026-10-23')
    const shown = displayOccurrence(
      {
        title: 'Circle',
        scheduled_at: '2026-10-16T09:00:00.000Z',
        repeat: 'weekly',
        is_recurring: true,
        meeting_options: {
          skippedDates: ['2026-10-16'],
          occurrenceOverrides: [{ date: '2026-10-23', title: 'Circle — pricing' }],
        },
      },
      Date.parse('2026-10-16T08:00:00.000Z'),
    )
    expect(shown.title).toBe('Circle — pricing')
  })

  it('groups breakouts by topic and picks a co-presenter', () => {
    const groups = assignParticipantsToTopics({
      participants: [
        { userId: 'a', topic: 'Pricing' },
        { userId: 'b', topic: 'product' },
        { userId: 'c', topic: 'Pricing' },
      ],
      topics: ['Pricing', 'Product'],
    })
    expect(groups[0]?.userIds).toEqual(['a', 'c'])
    expect(groups[1]?.userIds).toEqual(['b'])
    expect(secondShareDecision({ activeSharerId: 'a', requesterId: 'b', allowSecond: true })).toBe(
      'co-presenter',
    )
    expect(secondShareDecision({ activeSharerId: 'a', requesterId: 'b', allowSecond: false })).toBe(
      'queued',
    )
  })

  it('formats chat mentions, replies, polls, and the green room gate', () => {
    expect(extractChatMentions('hi @Ada and @bea.shop')).toEqual(['Ada', 'bea.shop'])
    const reply = formatChatReply({ name: 'Ada', snippet: 'Ship it', body: 'On it' })
    expect(splitChatReply(reply).replyTo).toContain('Ada')
    expect(splitChatReply(reply).body).toBe('On it')
    expect(
      formatPollExport([{ question: 'Go?', status: 'open', options: [{ text: 'Yes', votes: 2 }] }]),
    ).toContain('Yes: 2')
    expect(canEnterFromGreenRoom({ greenRoomOpen: true, isSpeaker: false, canModerate: false })).toBe(
      false,
    )
    expect(canEnterFromGreenRoom({ greenRoomOpen: true, isSpeaker: true, canModerate: false })).toBe(
      true,
    )
    expect(whiteboardTemplateStrokes('swot', 'host', 1).map((stroke) => stroke.text)).toEqual([
      'Strengths',
      'Weaknesses',
      'Opportunities',
      'Threats',
    ])
    const older = { ...emptyMeetingStudio(), updatedAt: 1, sharedNotes: 'old' }
    const newer = { ...emptyMeetingStudio(), updatedAt: 2, sharedNotes: 'new' }
    expect(mergeMeetingStudio(older, newer).sharedNotes).toBe('new')
    expect(winningTimeSlot([
      { id: 'a', label: 'Mon', startsAt: 't', voterIds: ['1'] },
      { id: 'b', label: 'Tue', startsAt: 't', voterIds: ['1', '2'] },
    ])?.id).toBe('b')
  })
})
