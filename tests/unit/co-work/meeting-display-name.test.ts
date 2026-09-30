import { describe, expect, it } from 'vitest'

import {
  normalizeMeetingDisplayName,
  resolveMeetingDisplayName,
  safeMeetingDisplayName,
} from '~/co-work/lib/meeting-display-name'
import { meetingCodeFromInput } from '~/co-work/lib/meetings'

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

describe('resolveMeetingDisplayName', () => {
  const profile = { full_name: 'Sanjeev Shukla', username: 'sanjeev' }

  it('uses the signed-in account instead of the Guest placeholder', () => {
    expect(resolveMeetingDisplayName({ typed: 'Guest', remembered: 'guest', profile })).toBe(
      'Sanjeev Shukla',
    )
    expect(resolveMeetingDisplayName({ profile: { full_name: '', username: 'sanjeev' } })).toBe(
      'sanjeev',
    )
    expect(
      resolveMeetingDisplayName({ user: { user_metadata: { full_name: 'Ritu Singh' } } }),
    ).toBe('Ritu Singh')
  })

  it('prefers the name typed in the preview, then the remembered one', () => {
    expect(resolveMeetingDisplayName({ typed: 'Sanjeev (iPad)', remembered: 'S', profile })).toBe(
      'Sanjeev (iPad)',
    )
    expect(resolveMeetingDisplayName({ typed: '  ', remembered: 'Sanju', profile })).toBe('Sanju')
  })

  it('returns empty when nothing real is known', () => {
    expect(resolveMeetingDisplayName({ typed: 'user_00bc8abb', profile: null })).toBe('')
  })
})

describe('meetingCodeFromInput', () => {
  it('reads codes and pasted invite links', () => {
    expect(meetingCodeFromInput(' abc-def ghi ')).toBe('ABCDEFGHI')
    expect(meetingCodeFromInput('https://app.sheconomy.in/co-work/meeting/KEP-NTY-WPU?x=1')).toBe(
      'KEPNTYWPU',
    )
    expect(meetingCodeFromInput('Join: https://sheconomy.in/cowork/meeting/kepntywpu')).toBe(
      'KEPNTYWPU',
    )
  })
})
