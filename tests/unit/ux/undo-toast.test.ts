import { describe, expect, it } from 'vitest'

/**
 * Undo toasts expose an explicit actionLabel + onAction rather than making the
 * whole toast implicitly clickable. This mirrors the CustomData contract used
 * by `useAppToast().show(...)`.
 */
type UndoToastOpts = {
  actionLabel?: string
  onAction?: () => void
  onPress?: () => void
}

function isExplicitUndoToast(opts: UndoToastOpts) {
  return typeof opts.actionLabel === 'string' && typeof opts.onAction === 'function'
}

describe('undo toast contract', () => {
  it('requires an explicit action label and handler', () => {
    expect(
      isExplicitUndoToast({
        actionLabel: 'Undo',
        onAction: () => {},
      }),
    ).toBe(true)

    expect(
      isExplicitUndoToast({
        onPress: () => {},
      }),
    ).toBe(false)
  })
})
