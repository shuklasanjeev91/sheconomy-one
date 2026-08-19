import { describe, expect, it } from 'vitest'

import { overlayBackdropStyle, overlayPanelStyle } from '~/lib/layout/styles'

describe('viewport overlay styles', () => {
  it('sizes the backdrop to the viewport on web', () => {
    const style = overlayBackdropStyle() as Record<string, unknown>
    expect(style.position).toBe('fixed')
    expect(style.width).toBe('100vw')
    expect(style.height).toBe('100dvh')
  })

  it('pins the drawer panel to the right edge of the viewport', () => {
    const style = overlayPanelStyle() as Record<string, unknown>
    expect(style.position).toBe('fixed')
    expect(style.right).toBe(0)
    expect(style.top).toBe(0)
    expect(style.height).toBe('100dvh')
    expect(style.overflow).toBe('hidden')
  })
})
