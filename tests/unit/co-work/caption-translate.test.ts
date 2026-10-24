import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()

vi.mock('~/lib/ai/owned-service', () => ({
  invokeOwnedAssist: (...args: unknown[]) => invoke(...args),
}))

import {
  captionLooksLikeTargetLang,
  detectLatinCaptionLang,
  localizeCaptionLine,
  resolveLiveCaptionDisplay,
  translateCaptionText,
} from '~/co-work/lib/caption-translate'

describe('captionLooksLikeTargetLang', () => {
  it('detects Latin vs Devanagari for Hindi vs English', () => {
    expect(captionLooksLikeTargetLang('Hello hello', 'hi')).toBe(false)
    expect(captionLooksLikeTargetLang('नमस्ते', 'hi')).toBe(true)
    expect(captionLooksLikeTargetLang('Hello hello', 'en')).toBe(true)
    expect(captionLooksLikeTargetLang('नमस्ते', 'en')).toBe(false)
  })

  it('uses the correct Indic script per language (not Devanagari-only)', () => {
    expect(captionLooksLikeTargetLang('வணக்கம்', 'ta')).toBe(true)
    expect(captionLooksLikeTargetLang('नमस्ते', 'ta')).toBe(false)
    expect(captionLooksLikeTargetLang('నమస్కారం', 'te')).toBe(true)
    expect(captionLooksLikeTargetLang('স্বাগতম', 'bn')).toBe(true)
    expect(captionLooksLikeTargetLang('Hello', 'ta')).toBe(false)
  })

  it('does not treat English speech as already Spanish/French/German for Latin viewers', () => {
    expect(captionLooksLikeTargetLang('please share your updates one by one', 'es')).toBe(false)
    expect(captionLooksLikeTargetLang('today we will review the product launch', 'fr')).toBe(false)
    expect(captionLooksLikeTargetLang('hello everyone welcome to the meeting', 'de')).toBe(false)
    expect(captionLooksLikeTargetLang('Por favor, compartan sus actualizaciones una por una', 'es')).toBe(true)
    expect(captionLooksLikeTargetLang('Por favor, compartan sus actualizaciones una por una', 'en')).toBe(false)
    expect(captionLooksLikeTargetLang('Bonjour, merci pour votre présence', 'fr')).toBe(true)
    expect(captionLooksLikeTargetLang('Sprint', 'es')).toBe(true)
  })
})

describe('detectLatinCaptionLang', () => {
  it('guesses the language from common words and stays null when unclear', () => {
    expect(detectLatinCaptionLang('we will review the launch')).toBe('en')
    expect(detectLatinCaptionLang('hola, gracias por venir')).toBe('es')
    expect(detectLatinCaptionLang('Sprint')).toBeNull()
  })
})

describe('resolveLiveCaptionDisplay', () => {
  it('never flashes English interim when Show language is Hindi', () => {
    expect(
      resolveLiveCaptionDisplay({
        targetLang: 'hi',
        localInterimRaw: 'Hello everyone',
        localInterimTranslated: '',
        lastGoodLocalTranslated: 'नमस्ते',
      }),
    ).toBe('नमस्ते')

    expect(
      resolveLiveCaptionDisplay({
        targetLang: 'hi',
        localInterimRaw: 'Hello everyone',
        localInterimTranslated: 'नमस्ते दोस्तों',
      }),
    ).toBe('नमस्ते दोस्तों')
  })

  it('falls back to raw when translation is missing rather than blanking', () => {
    expect(
      resolveLiveCaptionDisplay({
        targetLang: 'hi',
        localInterimRaw: 'Hello everyone',
        localInterimTranslated: '',
        lastGoodLocalTranslated: '',
      }),
    ).toBe('Hello everyone')
  })

  it('prefers fallback over untranslated remote English for Hindi viewers', () => {
    expect(
      resolveLiveCaptionDisplay({
        targetLang: 'hi',
        remoteInterimText: 'How are you',
        remoteInterimTranslated: false,
        fallbackFinalText: 'अंतिम पंक्ति',
      }),
    ).toBe('अंतिम पंक्ति')
  })

  it('shows remote interim once localized into Hindi', () => {
    expect(
      resolveLiveCaptionDisplay({
        targetLang: 'hi',
        remoteInterimText: 'आप कैसे हैं',
        remoteInterimTranslated: true,
      }),
    ).toBe('आप कैसे हैं')
  })
})

describe('localizeCaptionLine', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('translates into the viewer language even when sourceLang was mis-tagged as the region', async () => {
    invoke.mockResolvedValue({
      translatedText: 'नमस्ते दोस्तों',
      detectedSourceLang: 'en',
      usedFallback: false,
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
      expect.objectContaining({
        action: 'translate',
        message: 'Hello everyone',
        context: expect.objectContaining({
          target_lang: 'hi',
          source_lang: 'auto',
        }),
      }),
    )
    expect(localized.text).toBe('नमस्ते दोस्तों')
    expect(localized.translated).toBe(true)
    expect(localized.targetLang).toBe('hi')
  })

  it('translates Hindi speech into English when English captions are selected', async () => {
    invoke.mockResolvedValue({
      translatedText: 'Hello friends',
      detectedSourceLang: 'hi',
      usedFallback: false,
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
