import { describe, expect, it } from 'vitest'

import {
  formatMeetingCode,
  meetingCodeVariants,
  normalizeMeetingCode,
} from '~/co-work/lib/meetings'

describe('meeting code matching', () => {
  it('treats dashed, spaced and plain codes as the same code', () => {
    expect(normalizeMeetingCode('VAC-LLM-WGO')).toBe('VACLLMWGO')
    expect(normalizeMeetingCode('vac llm wgo')).toBe('VACLLMWGO')
    expect(normalizeMeetingCode('VACLLMWGO')).toBe('VACLLMWGO')
  })

  it('looks up a dashed meeting from a code that lost its dashes', () => {
    const variants = meetingCodeVariants('VACLLMWGO')

    expect(variants).toContain('VACLLMWGO')
    expect(variants).toContain('VAC-LLM-WGO')
  })

  it('looks up a plain meeting from a dashed code', () => {
    const variants = meetingCodeVariants('VAC-LLM-WGO')

    expect(variants).toContain('VACLLMWGO')
    expect(variants).toContain('VAC-LLM-WGO')
  })

  it('ignores codes that are only separators', () => {
    expect(meetingCodeVariants('---')).toEqual([])
    expect(meetingCodeVariants('   ')).toEqual([])
  })

  it('groups a dashed code for display instead of mangling it', () => {
    expect(formatMeetingCode('VAC-LLM-WGO')).toBe('VAC LLM WGO')
    expect(formatMeetingCode('VACLLMWGO')).toBe('VAC LLM WGO')
  })
})
