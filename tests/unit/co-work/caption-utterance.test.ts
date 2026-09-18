import { describe, expect, it } from 'vitest'

import {
  isLikelyCaptionFragment,
  mergeCaptionHypothesis,
} from '~/co-work/lib/caption-utterance'

describe('mergeCaptionHypothesis', () => {
  it('keeps growing phrases from Android partial replacements', () => {
    expect(mergeCaptionHypothesis('', 'Hello')).toBe('Hello')
    expect(mergeCaptionHypothesis('Hello', 'Hello how')).toBe('Hello how')
    expect(mergeCaptionHypothesis('Hello how', 'Hello how are you')).toBe('Hello how are you')
  })

  it('appends when the engine only returns the newest word', () => {
    expect(mergeCaptionHypothesis('Hello how', 'are')).toBe('Hello how are')
    expect(mergeCaptionHypothesis('Hello how are', 'you')).toBe('Hello how are you')
  })

  it('merges overlapping suffix/prefix chunks', () => {
    expect(mergeCaptionHypothesis('Hello how', 'how are you')).toBe('Hello how are you')
  })

  it('does not duplicate when the new chunk is already contained', () => {
    expect(mergeCaptionHypothesis('Hello how are you', 'how')).toBe('Hello how are you')
  })
})

describe('isLikelyCaptionFragment', () => {
  it('treats short unfinished speech as a fragment', () => {
    expect(isLikelyCaptionFragment('Hello')).toBe(true)
    expect(isLikelyCaptionFragment('Hello how')).toBe(true)
    expect(isLikelyCaptionFragment('We should meet tomorrow at noon.')).toBe(false)
  })
})
