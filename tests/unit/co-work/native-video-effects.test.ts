import { describe, expect, it } from 'vitest'

import {
  captureNeedsUpdate,
  isPackedNativeAssetUri,
  nativeProcessorCanDecodeImageUri,
  nativeVideoEffectsProbe,
  shouldReuseMaterializedBackground,
  waitForNativeVideoEffects,
} from '~/co-work/lib/native-video-effects'

describe('native video effects probe', () => {
  it('treats a missing Expo module as unavailable', () => {
    expect(nativeVideoEffectsProbe(null)).toBe('missing')
    expect(nativeVideoEffectsProbe(undefined)).toBe('missing')
  })

  it('retries while React Native context is not ready yet', () => {
    expect(nativeVideoEffectsProbe({ registerProcessor: () => false })).toBe('retry')
    expect(
      nativeVideoEffectsProbe({
        registerProcessor: () => {
          throw new Error('context')
        },
      }),
    ).toBe('retry')
  })

  it('is ready once the processor registers, even if isSupported is pessimistic', () => {
    expect(
      nativeVideoEffectsProbe({
        registerProcessor: () => true,
        isSupported: () => false,
      }),
    ).toBe('ready')
  })

  it('waits for a late register instead of disabling effects on first paint', async () => {
    let calls = 0
    const native = {
      registerProcessor: () => {
        calls += 1
        return calls >= 3
      },
    }
    await expect(
      waitForNativeVideoEffects(native, {
        attempts: 5,
        delayMs: 1,
        sleep: async () => {},
      }),
    ).resolves.toBe(true)
    expect(calls).toBe(3)
  })

  it('does not restart capture for tiny resolution drift', () => {
    expect(captureNeedsUpdate({ width: 1280, height: 720 }, { width: 1280, height: 720 })).toBe(false)
    expect(captureNeedsUpdate({ width: 1264, height: 712 }, { width: 1280, height: 720 })).toBe(false)
    expect(captureNeedsUpdate({ width: 640, height: 360 }, { width: 1280, height: 720 })).toBe(true)
    expect(captureNeedsUpdate(undefined, { width: 1280, height: 720 })).toBe(true)
  })
})

describe('native processor image paths', () => {
  it('rejects packed Android asset URIs that BitmapFactory cannot decode', () => {
    expect(isPackedNativeAssetUri('file:///android_res/drawable/office.png')).toBe(true)
    expect(nativeProcessorCanDecodeImageUri('file:///android_res/drawable/office.png')).toBe(false)
    expect(
      nativeProcessorCanDecodeImageUri(
        'http://localhost:8081/assets/public/meeting-backgrounds/office.png?platform=android',
      ),
    ).toBe(false)
    expect(
      nativeProcessorCanDecodeImageUri('file:///data/user/0/app/cache/meeting-background-office-1.jpg'),
    ).toBe(true)
  })
})

describe('materialized background cache reuse', () => {
  it('reuses an already-copied cache file for the same background id', () => {
    expect(
      shouldReuseMaterializedBackground(
        'file:///cache/meeting-background-office-123.jpg',
        'office',
      ),
    ).toBe(true)
    expect(
      shouldReuseMaterializedBackground(
        'file:///cache/meeting-background-office-123.jpg',
        'lounge',
      ),
    ).toBe(false)
  })
})
