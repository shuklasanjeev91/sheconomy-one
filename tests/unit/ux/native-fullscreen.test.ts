import { describe, expect, it } from 'vitest'

import {
  NATIVE_FULLSCREEN_SNAP_POINTS,
  isNativeFullscreenForPlatform,
} from '~/lib/platform/native-fullscreen-core'

describe('native fullscreen overlay helpers', () => {
  it('exports a 100% snap point for native sheets', () => {
    expect(NATIVE_FULLSCREEN_SNAP_POINTS).toEqual([100])
  })

  it('treats iOS and Android as fullscreen platforms', () => {
    expect(isNativeFullscreenForPlatform('ios')).toBe(true)
    expect(isNativeFullscreenForPlatform('android')).toBe(true)
    expect(isNativeFullscreenForPlatform('web')).toBe(false)
  })
})
