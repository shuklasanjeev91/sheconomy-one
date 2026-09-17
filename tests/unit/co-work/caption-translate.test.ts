import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()

vi.mock('~/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invoke(...args),
    },
  },
}))

import {
  captionLooksLikeTargetLang,
  localizeCaptionLine,
  translateCaptionText,
} from '~/co-work/lib/caption-translate'

describe('captionLooksLikeTargetLang', () => {
  it('detects Latin vs Devanagari for Hindi vs English', () => {
    expect(captionLooksLikeTargetLang('Hello hello', 'hi')).toBe(false)
    expect(captionLooksLikeTargetLang('नमस्ते', 'hi')).toBe(true)
    expect(captionLooksLikeTargetLang('Hello hello', 'en')).toBe(true)
    expect(captionLooksLikeTargetLang('नमस्ते', 'en')).toBe(false)
  })
})

describe('localizeCaptionLine', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('translates into the viewer language even when sourceLang was mis-tagged as the region', async () => {
    invoke.mockResolvedValue({
      data: {
        translatedText: 'नमस्ते दोस्तों',
        detectedSourceLang: 'en',
        usedFallback: false,
      },
      error: null,
    })

    const localized = await localizeCaptionLine(
      {
        id: '1',
        userId: 'u1',
        speaker: 'Alex',
        text: 'Hello everyone',
        originalText: 'Hello everyone',
        sourceLang: 'hi',
        isFinal: true,
        timestamp: 1,
      },
      'hi',
    )

    expect(invoke).toHaveBeenCalledWith(
      'ai-assist',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'translate',
          message: 'Hello everyone',
          context: expect.objectContaining({
            target_lang: 'hi',
            source_lang: 'auto',
          }),
        }),
      }),
    )
    expect(localized.text).toBe('नमस्ते दोस्तों')
    expect(localized.translated).toBe(true)
    expect(localized.targetLang).toBe('hi')
  })

  it('translates Hindi speech into English when English captions are selected', async () => {
    invoke.mockResolvedValue({
      data: {
        translatedText: 'Hello friends',
        detectedSourceLang: 'hi',
        usedFallback: false,
      },
      error: null,
    })

    const localized = await localizeCaptionLine(
      {
        id: '2',
        userId: 'u2',
        speaker: 'Riya',
        text: 'नमस्ते दोस्तों',
        originalText: 'नमस्ते दोस्तों',
        sourceLang: 'en',
        isFinal: true,
        timestamp: 2,
      },
      'en',
    )

    expect(localized.text).toBe('Hello friends')
    expect(localized.translated).toBe(true)
  })

  it('skips the network when text already matches the target script', async () => {
    const localized = await localizeCaptionLine(
      {
        id: '3',
        userId: 'u3',
        speaker: 'Riya',
        text: 'नमस्ते',
        originalText: 'नमस्ते',
        sourceLang: 'auto',
        isFinal: true,
        timestamp: 3,
      },
      'hi',
    )
    expect(invoke).not.toHaveBeenCalled()
    expect(localized.text).toBe('नमस्ते')
    expect(localized.translated).toBe(false)
  })
})

describe('translateCaptionText', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('returns empty text as a skipped no-op', async () => {
    const result = await translateCaptionText({ text: '  ', targetLang: 'hi' })
    expect(result.skipped).toBe(true)
    expect(invoke).not.toHaveBeenCalled()
  })
})
