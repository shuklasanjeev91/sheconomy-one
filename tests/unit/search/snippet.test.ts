import { describe, expect, it } from 'vitest'

import { toSearchSnippet } from '~/lib/search/federate'

describe('search snippets', () => {
  it('turns stored post markup into a single readable line', () => {
    const raw =
      'FB account shuffle: <br><a href="https://community.sheconomy.in/hashtag/fbacebook">#fbacebook</a>'
    expect(toSearchSnippet(raw)).toBe('FB account shuffle: #fbacebook')
    expect(toSearchSnippet(`${raw} https://www.facebook.com/share/14MLN`)).toBe(
      'FB account shuffle: #fbacebook',
    )
  })

  it('trims a long plain sentence', () => {
    const raw = 'The Inaugural Session of TOWNHALL by ALL x SHEconomy just begins. April 13, 2024 and more words follow here.'
    expect(toSearchSnippet(raw, 40).endsWith('…')).toBe(true)
    expect(toSearchSnippet(raw, 40).length).toBeLessThanOrEqual(40)
  })
})