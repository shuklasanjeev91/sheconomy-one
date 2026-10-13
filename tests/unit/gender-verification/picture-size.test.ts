import { describe, expect, it } from 'vitest'

import { pickAnalysisPictureSize } from '~/lib/gender-verification/picture-size'

describe('pickAnalysisPictureSize', () => {
  it('picks the smallest iOS size that is still large enough, skipping presets', () => {
    const sizes = ['3840x2160', '1920x1080', '1280x720', '640x480', '352x288', 'Photo', 'High', 'Low']
    expect(pickAnalysisPictureSize(sizes, 640)).toBe('640x480')
  })

  it('handles Android sizes in any order', () => {
    expect(pickAnalysisPictureSize(['4032x3024', '320x240', '800x600', '1280x960'], 640)).toBe('800x600')
  })

  it('returns undefined when nothing qualifies so the camera keeps its default', () => {
    expect(pickAnalysisPictureSize(['Photo', '320x240'], 640)).toBeUndefined()
    expect(pickAnalysisPictureSize([], 640)).toBeUndefined()
  })
})
