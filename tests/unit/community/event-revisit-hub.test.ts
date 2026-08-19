import { describe, expect, it } from 'vitest'

import {
  buildEventRevisitCards,
  isEventRevisitRelevant,
  type EventRevisitCandidate,
} from '~/community/lib/event-revisit-hub'

const NOW = new Date('2026-08-19T12:00:00.000Z').getTime()

function makeCandidate(
  overrides: Partial<EventRevisitCandidate> & Pick<EventRevisitCandidate, 'source' | 'title'>,
): EventRevisitCandidate {
  return {
    postId: null,
    eventId: null,
    startTime: '2026-08-25T10:00:00.000Z',
    endTime: null,
    location: null,
    imageUrl: null,
    subtitle: null,
    ...overrides,
  }
}

describe('isEventRevisitRelevant', () => {
  it('keeps undated events visible', () => {
    expect(isEventRevisitRelevant(null, NOW)).toBe(true)
  })

  it('drops events that ended more than a day ago', () => {
    expect(isEventRevisitRelevant('2026-08-17T10:00:00.000Z', NOW)).toBe(false)
  })

  it('keeps events starting soon and recently started ones', () => {
    expect(isEventRevisitRelevant('2026-08-25T10:00:00.000Z', NOW)).toBe(true)
    expect(isEventRevisitRelevant('2026-08-19T08:00:00.000Z', NOW)).toBe(true)
  })
})

describe('buildEventRevisitCards', () => {
  it('dedupes by event id and prefers RSVP over saved', () => {
    const cards = buildEventRevisitCards(
      [
        makeCandidate({
          source: 'saved',
          eventId: 'event-1',
          postId: 'post-1',
          title: 'Saved title',
        }),
        makeCandidate({
          source: 'rsvp',
          eventId: 'event-1',
          postId: 'post-1',
          title: 'RSVP title',
        }),
      ],
      8,
      NOW,
    )

    expect(cards).toHaveLength(1)
    expect(cards[0]?.source).toBe('rsvp')
    expect(cards[0]?.title).toBe('RSVP title')
    expect(cards[0]?.sourceLabel).toBe("You're going")
  })

  it('sorts upcoming events by start time ascending', () => {
    const cards = buildEventRevisitCards(
      [
        makeCandidate({
          source: 'registration',
          eventId: 'event-late',
          title: 'Later event',
          startTime: '2026-08-30T10:00:00.000Z',
        }),
        makeCandidate({
          source: 'registration',
          eventId: 'event-soon',
          title: 'Soon event',
          startTime: '2026-08-20T10:00:00.000Z',
        }),
      ],
      8,
      NOW,
    )

    expect(cards.map((card) => card.title)).toEqual(['Soon event', 'Later event'])
  })

  it('limits cards to the requested count', () => {
    const cards = buildEventRevisitCards(
      Array.from({ length: 5 }, (_, index) =>
        makeCandidate({
          source: 'saved',
          eventId: `event-${index}`,
          title: `Event ${index}`,
          startTime: `2026-08-${20 + index}T10:00:00.000Z`,
        }),
      ),
      3,
      NOW,
    )

    expect(cards).toHaveLength(3)
  })

  it('builds event detail hrefs when an event id is present', () => {
    const cards = buildEventRevisitCards(
      [
        makeCandidate({
          source: 'registration',
          eventId: 'event-abc',
          title: 'Registered event',
        }),
      ],
      8,
      NOW,
    )

    expect(cards[0]?.href).toBe('/community/events/event-abc')
    expect(cards[0]?.whenLabel).toContain('Aug')
  })
})
