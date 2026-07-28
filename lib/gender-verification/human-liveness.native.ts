/** Native stub — Human liveness runs in the WebView analyzer on iOS/Android. */
import { GENDER_VERIFICATION } from '~/lib/gender-verification/constants'

export async function getHuman(): Promise<never> {
  throw new Error('Human liveness is web-only here; use NativeFaceAnalyzer on native.')
}

export async function preloadHumanModels() {}

export type HumanLivenessFrame = {
  faceDetected: boolean
  faceCentered: boolean
  facingCamera: boolean
  eyesClosed: boolean
  blinkLeft: boolean
  blinkRight: boolean
  leftEar: number
  rightEar: number
  avgEar: number
  liveScore: number
  realScore: number
  gender: null
  box: null
  gestures: string[]
}

export async function detectHumanLivenessFrame(
  _source: unknown,
): Promise<HumanLivenessFrame> {
  return {
    faceDetected: false,
    faceCentered: false,
    facingCamera: false,
    eyesClosed: false,
    blinkLeft: false,
    blinkRight: false,
    leftEar: 0.3,
    rightEar: 0.3,
    avgEar: 0.3,
    liveScore: 0,
    realScore: 0,
    gender: null,
    box: null,
    gestures: [],
  }
}

export type GestureBlinkTracker = {
  count: number
  eyesClosed: boolean
  closedAt: number | null
  lastBlinkAt: number | null
}

export function createGestureBlinkTracker(): GestureBlinkTracker {
  return { count: 0, eyesClosed: false, closedAt: null, lastBlinkAt: null }
}

export function updateGestureBlinkTracker(
  tracker: GestureBlinkTracker,
  eyesClosed: boolean,
  now = Date.now(),
): GestureBlinkTracker {
  if (eyesClosed && !tracker.eyesClosed) {
    tracker.eyesClosed = true
    tracker.closedAt = now
    return tracker
  }
  if (!eyesClosed && tracker.eyesClosed) {
    const closedFor = tracker.closedAt != null ? now - tracker.closedAt : 0
    if (
      closedFor >= GENDER_VERIFICATION.minClosedMs &&
      closedFor <= GENDER_VERIFICATION.maxClosedMs
    ) {
      if (
        tracker.lastBlinkAt == null ||
        now - tracker.lastBlinkAt >= GENDER_VERIFICATION.minBlinkGapMs
      ) {
        tracker.count += 1
        tracker.lastBlinkAt = now
      }
    }
    tracker.eyesClosed = false
    tracker.closedAt = null
  }
  return tracker
}

export function passesAntiSpoof(liveScore: number, realScore: number) {
  return (
    liveScore >= GENDER_VERIFICATION.minLiveScore &&
    realScore >= GENDER_VERIFICATION.minRealScore
  )
}
