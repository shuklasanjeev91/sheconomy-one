import { describe, expect, it } from 'vitest'

import {
  compareMeetingActivity,
  type MeetingActivitySignals,
} from '~/co-work/lib/meeting-participant-order'

const sortNames = (people: MeetingActivitySignals[]) =>
  [...people].sort(compareMeetingActivity).map((person) => person.name)

describe('meeting participant order', () => {
  it('sorts inactive participants alphabetically, ignoring case', () => {
    expect(
      sortNames([
        { id: '1', name: 'zoe' },
        { id: '2', name: 'Adam' },
        { id: '3', name: 'bella' },
      ]),
    ).toEqual(['Adam', 'bella', 'zoe'])
  })

  it('puts talking, then unmuted, then video-on participants ahead of the rest', () => {
    expect(
      sortNames([
        { id: '1', name: 'Anna' },
        { id: '2', name: 'Video', videoOn: true },
        { id: '3', name: 'Unmuted', micOn: true },
        { id: '4', name: 'Talking', speaking: true, micOn: true },
        { id: '5', name: 'Current', activeSpeaker: true },
      ]),
    ).toEqual(['Current', 'Talking', 'Unmuted', 'Video', 'Anna'])
  })

  it('sorts alphabetically within the same activity tier', () => {
    expect(
      sortNames([
        { id: '1', name: 'Priya', micOn: true },
        { id: '2', name: 'Aisha', micOn: true },
      ]),
    ).toEqual(['Aisha', 'Priya'])
  })

  it('leads each tier with the local viewer', () => {
    expect(
      sortNames([
        { id: '1', name: 'Aisha' },
        { id: 'me', name: 'Zoya', self: true },
        { id: '2', name: 'Bina', videoOn: true },
      ]),
    ).toEqual(['Bina', 'Zoya', 'Aisha'])
  })

  it('uses natural number order and a stable id tie-breaker', () => {
    expect(
      sortNames([
        { id: 'b', name: 'Guest 10' },
        { id: 'a', name: 'Guest 2' },
      ]),
    ).toEqual(['Guest 2', 'Guest 10'])
    const twins = [
      { id: 'b', name: 'Sam' },
      { id: 'a', name: 'Sam' },
    ].sort(compareMeetingActivity)
    expect(twins.map((person) => person.id)).toEqual(['a', 'b'])
  })
})
