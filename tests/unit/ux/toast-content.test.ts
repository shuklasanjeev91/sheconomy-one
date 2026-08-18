import { describe, expect, it } from 'vitest'

import { resolveToastText } from '~/lib/ux/toast-text'

/**
 * Several call sites hand a server string straight to `toast.show(...)`
 * (`toast.show(result.error)`), so the title can arrive undefined or blank.
 * When that happened the card still mounted and painted as an empty white box
 * over the app header, so an unreadable toast must resolve to nothing.
 */
describe('toast text resolution', () => {
  it('keeps a title and message pair', () => {
    expect(resolveToastText('Saved to wishlist', 'Find it under Saved')).toEqual({
      title: 'Saved to wishlist',
      message: 'Find it under Saved',
    })
  })

  it('trims whitespace-only values away', () => {
    expect(resolveToastText('  Saved  ', '   ')).toEqual({ title: 'Saved' })
  })

  it('promotes the message when the title is missing', () => {
    expect(resolveToastText(undefined, 'Could not reach the server')).toEqual({
      title: 'Could not reach the server',
    })
  })

  it('resolves to nothing when there is no readable text', () => {
    expect(resolveToastText(undefined, undefined)).toBeNull()
    expect(resolveToastText('', '')).toBeNull()
    expect(resolveToastText('   ')).toBeNull()
  })
})
