import { describe, expect, it } from 'vitest'

import {
  ScreenShareCancelledError,
  isScreenShareCancellation,
} from '~/co-work/lib/meeting-screen-share'

function domError(name: string, message: string) {
  const error = new Error(message)
  error.name = name
  return error
}

describe('isScreenShareCancellation', () => {
  it('treats closing the share picker as a quiet no-op', () => {
    expect(isScreenShareCancellation(new ScreenShareCancelledError())).toBe(true)
    expect(isScreenShareCancellation(domError('NotAllowedError', 'Permission denied'))).toBe(true)
    expect(isScreenShareCancellation(domError('AbortError', 'The operation was aborted.'))).toBe(true)
    expect(isScreenShareCancellation(new Error('Screen share was cancelled.'))).toBe(true)
  })

  it('still reports blocks and real failures', () => {
    expect(isScreenShareCancellation(domError('NotAllowedError', 'Permission denied by system'))).toBe(
      false,
    )
    expect(isScreenShareCancellation(domError('NotReadableError', 'Could not start video source'))).toBe(
      false,
    )
    expect(isScreenShareCancellation(new Error('Screen share picker is not ready.'))).toBe(false)
    expect(isScreenShareCancellation(undefined)).toBe(false)
  })
})
