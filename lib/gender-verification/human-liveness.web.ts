import type { Config, FaceResult, Result } from '@vladmandic/human'
import { GENDER_VERIFICATION } from '~/lib/gender-verification/constants'
import type { GenderEstimate } from '~/lib/gender-verification/constants'

type HumanCtor = new (config?: Partial<Config>) => {
  load: () => Promise<void>
  warmup: () => Promise<unknown>
  detect: (input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => Promise<Result>
}

let humanPromise: Promise<InstanceType<HumanCtor>> | null = null

const HUMAN_MODEL_BASE =
  'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/'

const humanConfig: Partial<Config> = {
  backend: 'webgl',
  modelBasePath: HUMAN_MODEL_BASE,
  cacheSensitivity: 0,
  debug: false,
  warmup: 'none',
  face: {
    enabled: true,
    detector: {
      maxDetected: 1,
      minConfidence: 0.5,
      rotation: true,
      return: true,
    },
    mesh: { enabled: true },
    iris: { enabled: true },
    description: { enabled: true },
    emotion: { enabled: false },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: true },
  segmentation: { enabled: false },
}

export async function getHuman() {
  if (!humanPromise) {
    humanPromise = (async () => {
      // Force browser ESM build (package "main" points at Node which needs tfjs-node).
      const mod = await import('@vladmandic/human')
      const Human = (mod.default ?? mod) as HumanCtor
      const human = new Human(humanConfig)
      await human.load()
      await human.warmup()
      return human
    })()
  }
  return humanPromise
}

export async function preloadHumanModels() {
  await getHuman()
}

export type HumanLivenessFrame = {
  faceDetected: boolean
  faceCentered: boolean
  facingCamera: boolean
  eyesClosed: boolean
  blinkLeft: boolean
  blinkRight: boolean
  liveScore: number
  realScore: number
  gender: GenderEstimate | null
  box: { xMin: number; xMax: number; yMin: number; yMax: number } | null
  gestures: string[]
}

function isFacingCamera(gestures: string[]) {
  return gestures.some((g) => g === 'facing center' || g === 'facing camera')
}

function boxFromFace(face: FaceResult) {
  const [x, y, w, h] = face.box
  return {
    xMin: x,
    xMax: x + w,
    yMin: y,
    yMax: y + h,
  }
}

function isCenteredBox(
  box: { xMin: number; xMax: number; yMin: number; yMax: number },
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) return false
  const cx = (box.xMin + box.xMax) / 2
  const cy = (box.yMin + box.yMax) / 2
  const fw = box.xMax - box.xMin
  const fh = box.yMax - box.yMin
  return (
    Math.abs(cx - width / 2) < width * 0.28 &&
    Math.abs(cy - height / 2) < height * 0.3 &&
    fw > width * 0.16 &&
    fw < width * 0.92
  )
}

/**
 * Run one Human detection pass for liveness + anti-spoof + gender.
 * Blink comes from Human face-mesh gestures (not brittle EAR thresholds).
 */
export async function detectHumanLivenessFrame(
  source: HTMLVideoElement | HTMLCanvasElement,
): Promise<HumanLivenessFrame> {
  const human = await getHuman()
  const result: Result = await human.detect(source)
  const face = result.face?.[0]
  const gestures = (result.gesture ?? []).map((g) => String(g.gesture))
  const blinkLeft = gestures.includes('blink left eye')
  const blinkRight = gestures.includes('blink right eye')

  if (!face) {
    return {
      faceDetected: false,
      faceCentered: false,
      facingCamera: false,
      eyesClosed: false,
      blinkLeft: false,
      blinkRight: false,
      liveScore: 0,
      realScore: 0,
      gender: null,
      box: null,
      gestures,
    }
  }

  const width =
    'videoWidth' in source
      ? source.videoWidth || source.clientWidth
      : source.width
  const height =
    'videoHeight' in source
      ? source.videoHeight || source.clientHeight
      : source.height

  const box = boxFromFace(face)
  const gender: GenderEstimate | null =
    face.gender && face.genderScore != null
      ? {
          isFemale: face.gender === 'female',
          confidence: Number(face.genderScore.toFixed(3)),
        }
      : null

  return {
    faceDetected: true,
    faceCentered: isCenteredBox(box, width, height),
    facingCamera: isFacingCamera(gestures),
    eyesClosed: blinkLeft || blinkRight,
    blinkLeft,
    blinkRight,
    liveScore: Number(face.live ?? 0),
    realScore: Number(face.real ?? 0),
    gender,
    box,
    gestures,
  }
}

/** Temporal blink counter — natural blink duration window rejects photo spoofs. */
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
    const gapOk =
      tracker.lastBlinkAt == null || now - tracker.lastBlinkAt >= GENDER_VERIFICATION.minBlinkGapMs
    // Natural blink window (~80ms–900ms). Static photos never open/close.
    if (
      closedFor >= GENDER_VERIFICATION.minClosedMs &&
      closedFor <= GENDER_VERIFICATION.maxClosedMs &&
      gapOk
    ) {
      tracker.count += 1
      tracker.lastBlinkAt = now
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
