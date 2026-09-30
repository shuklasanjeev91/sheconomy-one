import { describe, expect, it } from 'vitest'

import { ANDROID_PRESENT_UNAVAILABLE_MESSAGE } from '~/co-work/lib/android-present-build'
import { softMediaToggleFailure } from '~/co-work/lib/meeting-mobile'

describe('Screen-share failure copy', () => {
  it('preserves Play-update copy when Android Present is blocked on old binaries', () => {
    expect(softMediaToggleFailure('screen_share', new Error(ANDROID_PRESENT_UNAVAILABLE_MESSAGE))).toBe(
      ANDROID_PRESENT_UNAVAILABLE_MESSAGE,
    )
  })

  it('preserves MediaProjection blank-frame errors in soft toggle copy', () => {
    expect(
      softMediaToggleFailure(
        'screen_share',
        new Error('Screen share started without video frames. Update SHEconomy to the latest Android build'),
      ),
    ).toMatch(/without video frames/i)
  })

  it('preserves iOS ReplayKit blank-frame errors in soft toggle copy', () => {
    expect(
      softMediaToggleFailure(
        'screen_share',
        new Error(
          'Screen share started without video frames. Choose SHEconomy → Start Broadcast, keep the red status bar visible, and try again.',
        ),
      ),
    ).toMatch(/Start Broadcast/i)
  })
})
