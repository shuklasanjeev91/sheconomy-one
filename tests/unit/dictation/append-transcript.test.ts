import { describe, expect, it } from 'vitest'

import { appendTranscript, withInterimTranscript } from '~/lib/dictation/append-transcript'

describe('appendTranscript', () => {
  it('returns spoken text when base is empty', () => {
    expect(appendTranscript('', 'hello')).toBe('hello')
  })

  it('inserts a space between words', () => {
    expect(appendTranscript('Hello', 'world')).toBe('Hello world')
  })

  it('does not double spaces', () => {
    expect(appendTranscript('Hello ', 'world')).toBe('Hello world')
  })

  it('keeps punctuation flush', () => {
    expect(appendTranscript('Hello', ', world')).toBe('Hello, world')
  })
})

describe('withInterimTranscript', () => {
  it('previews speech on top of the committed base', () => {
    expect(withInterimTranscript('Order', 'two')).toBe('Order two')
  })
})
