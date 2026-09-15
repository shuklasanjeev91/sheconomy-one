import { describe, expect, it } from 'vitest'

import {
  normalizeMeetingDisplayName,
  safeMeetingDisplayName,
} from '~/co-work/lib/meeting-display-name'

describe('meeting display names', () => {
  it('trims and limits participant-provided names', () => {
    expect(normalizeMeetingDisplayName('  Priya Sharma  ')).toBe('Priya Sharma')
    expect(normalizeMeetingDisplayName('A'.repeat(100))).toHaveLength(80)
  })

  it('never exposes internal account identifiers as names', () => {
    expect(normalizeMeetingDisplayName('user_00bc8abb')).toBe('')
    expect(normalizeMeetingDisplayName('550e8400-e29b-41d4-a716-446655440000')).toBe('')
    expect(safeMeetingDisplayName('user_00bc8abb')).toBe('Guest')
  })

  it('uses a caller-provided safe fallback', () => {
    expect(safeMeetingDisplayName('', 'Participant')).toBe('Participant')
  })
})
