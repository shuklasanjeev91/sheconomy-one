import { describe, expect, it } from 'vitest'

import {
  filterPostsByMutedWords,
  normalizeMutedWord,
  postMatchesMutedWords,
} from '~/community/lib/muted-words'

describe('muted words', () => {
  it('stores a lowercase word and drops punctuation', () => {
    expect(normalizeMutedWord('  #Sale  ')).toBe('sale')
    expect(normalizeMutedWord('a')).toBeNull()
    expect(normalizeMutedWord('give away')).toBeNull()
  })

  it('matches a whole word inside html and leaves partials alone', () => {
    expect(postMatchesMutedWords('<p>Big sale today</p>', ['sale'])).toBe(true)
    expect(postMatchesMutedWords('Sales are up', ['sale'])).toBe(false)
    expect(postMatchesMutedWords('hello', [])).toBe(false)
  })

  it('drops matching posts from the feed', () => {
    const posts = [
      { id: '1', content: 'Join the sale' },
      { id: '2', content: 'Studio tour' },
    ]
    expect(filterPostsByMutedWords(posts, ['sale']).map((post) => post.id)).toEqual(['2'])
  })
})
