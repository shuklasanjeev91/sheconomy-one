import { describe, expect, it } from 'vitest'

import { connectionStatusLabel } from '~/co-work/lib/meeting-audio-quality'

describe('meeting audio connection quality', () => {
  it('formats the required connection labels', () => {
    expect(connectionStatusLabel('excellent')).toBe('Excellent')
    expect(connectionStatusLabel('good')).toBe('Good')
    expect(connectionStatusLabel('poor')).toBe('Poor')
    expect(connectionStatusLabel('reconnecting')).toBe('Reconnecting')
  })
})
