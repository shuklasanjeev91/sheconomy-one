import { describe, expect, it } from 'vitest'

import { normalizeLiveCaptionPreferences } from '~/co-work/hooks/useLiveCaptions'
import { captionOverlayLayout } from '~/co-work/lib/caption-overlay-layout'

describe('live caption viewer preferences', () => {
  it('uses the viewer region language for new preferences', () => {
    expect(normalizeLiveCaptionPreferences(null, 'hi')).toEqual({
      targetLang: 'hi',
      spokenLang: 'auto',
      collapsed: false,
      size: 'comfortable',
      placement: 'bottom',
      offsetX: 0,
      offsetY: 0,
    })
  })

  it('preserves valid independent display preferences', () => {
    expect(
      normalizeLiveCaptionPreferences(
        {
          targetLang: 'fr',
          spokenLang: 'en',
          collapsed: true,
          size: 'large',
          placement: 'top',
        },
        'en',
      ),
    ).toEqual({
      targetLang: 'fr',
      spokenLang: 'en',
      collapsed: true,
      size: 'large',
      placement: 'top',
      offsetX: 0,
      offsetY: 0,
    })
  })

  it('repairs unsupported persisted values', () => {
    expect(
      normalizeLiveCaptionPreferences(
        {
          targetLang: 'xx',
          spokenLang: 'zz',
          size: 'huge' as never,
          placement: 'left' as never,
        },
        'de',
      ),
    ).toEqual({
      targetLang: 'de',
      spokenLang: 'auto',
      collapsed: false,
      size: 'comfortable',
      placement: 'bottom',
      offsetX: 0,
      offsetY: 0,
    })
  })

  it('keeps captions in a side band so a shared screen stays visible', () => {
    const desktopShare = captionOverlayLayout({
      size: 'comfortable',
      placement: 'bottom',
      viewportWidth: 1280,
      viewportHeight: 800,
      presentationSafe: true,
      wideLayout: true,
    })
    expect(desktopShare.align).toBe('flex-start')
    expect(desktopShare.maxWidth).toBeLessThan(520)

    const phoneShare = captionOverlayLayout({
      size: 'comfortable',
      placement: 'bottom',
      viewportWidth: 390,
      viewportHeight: 844,
      presentationSafe: true,
      wideLayout: false,
    })
    expect(phoneShare.placement).toBe('top')
  })
})
