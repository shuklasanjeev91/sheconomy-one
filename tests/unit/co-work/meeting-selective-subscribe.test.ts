import { describe, expect, it } from 'vitest'

import { resolveSubscribeCameraIdentities } from '~/co-work/lib/meeting-selective-subscribe'

describe('resolveSubscribeCameraIdentities', () => {
  it('subscribes every remote when the room is small (1–N Zoom gallery)', () => {
    const remotes = Array.from({ length: 12 }, (_, i) => `u${i}`)
    expect(
      resolveSubscribeCameraIdentities({
        remoteIdentities: remotes,
        pageIdentities: ['u0', 'u1'],
      }),
    ).toEqual(remotes)
  })

  it('caps to visible page + filmstrip + speakers in large rooms', () => {
    const remotes = Array.from({ length: 80 }, (_, i) => `u${i}`)
    expect(
      resolveSubscribeCameraIdentities({
        remoteIdentities: remotes,
        pageIdentities: ['u0', 'u1', 'u2'],
        filmstripIdentities: ['u10'],
        speakingIdentities: ['u50'],
      }),
    ).toEqual(['u0', 'u1', 'u2', 'u10', 'u50'])
  })
})
