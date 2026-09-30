import { describe, expect, it } from 'vitest'

import {
  identitiesFromActiveSpeakers,
  resolveActiveSpeakerIdentity,
} from '~/co-work/lib/meeting-active-speaker'

describe('meeting active speaker', () => {
  it('picks the loudest audible speaker', () => {
    expect(
      resolveActiveSpeakerIdentity({
        candidates: [
          { identity: 'a', audioLevel: 0.1, isSpeaking: true },
          { identity: 'b', audioLevel: 0.4, isSpeaking: true },
          { identity: 'c', audioLevel: 0.02, isSpeaking: false },
        ],
      }),
    ).toBe('b')
  })

  it('keeps the previous speaker during silence', () => {
    expect(
      resolveActiveSpeakerIdentity({
        previousIdentity: 'a',
        candidates: [
          { identity: 'a', audioLevel: 0, isSpeaking: false },
          { identity: 'b', audioLevel: 0, isSpeaking: false },
        ],
      }),
    ).toBe('a')
  })

  it('requires a clear audio margin before switching', () => {
    expect(
      resolveActiveSpeakerIdentity({
        previousIdentity: 'a',
        switchMargin: 0.12,
        candidates: [
          { identity: 'a', audioLevel: 0.3, isSpeaking: true },
          { identity: 'b', audioLevel: 0.35, isSpeaking: true },
        ],
      }),
    ).toBe('a')

    expect(
      resolveActiveSpeakerIdentity({
        previousIdentity: 'a',
        switchMargin: 0.12,
        candidates: [
          { identity: 'a', audioLevel: 0.3, isSpeaking: true },
          { identity: 'b', audioLevel: 0.5, isSpeaking: true },
        ],
      }),
    ).toBe('b')
  })

  it('dedupes active speaker payloads', () => {
    expect(
      identitiesFromActiveSpeakers([
        { identity: 'a' },
        { identity: 'a' },
        { identity: 'b' },
        { identity: null },
      ]),
    ).toEqual(['a', 'b'])
  })
})
