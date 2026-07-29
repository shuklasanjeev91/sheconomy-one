import type { Config, FaceResult, Result } from '@vladmandic/human'
import {
  GENDER_VERIFICATION,
  LEFT_EYE_INDICES,
  RIGHT_EYE_INDICES,
} from '~/lib/gender-verification/constants'
import type { GenderEstimate } from '~/lib/gender-verification/constants'
import { eyeAspectRatio } from '~/lib/gender-verification/blink'

type HumanInstance = {
  load: () => Promise<void>
  warmup: () => Promise<unknown>
  detect: (input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement) => Promise<Result>
  config: Config
}

type HumanCtor = new (config?: Partial<Config>) => HumanInstance

let humanPromise: Promise<HumanInstance> | null = null
let detectCanvas: HTMLCanvasElement | null = null
let frameSeq = 0

const HUMAN_MODEL_BASE =
  'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/'

/** Lighter than full Human defaults — iris/gesture/emotion are expensive and unused. */
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
      minConfidence: 0.45,
      rotation: false,
      return: true,
    },
    mesh: { enabled: true },
    iris: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: false },
    antispoof: { enabled: true },
    liveness: { enabled: true },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
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
      // warmup: 'none' — skip the expensive dummy inference pass.
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
  leftEar: number
  rightEar: number
  avgEar: number
  liveScore: number
  realScore: number
  gender: GenderEstimate | null
  box: { xMin: number; xMax: number; yMin: number; yMax: number } | null
  gestures: string[]
}

type MeshPoint = number[] | { x: number; y: number; z?: number }

function asPoint(point: MeshPoint | undefined): { x: number; y: number } | null {
  if (!point) return null
  if (Array.isArray(point)) {
    if (point.length < 2) return null
    return { x: point[0], y: point[1] }
  }
  if (typeof point.x === 'number' && typeof point.y === 'number') {
    return { x: point.x, y: point.y }
  }
  return null
}

/** Continuous eye openness from face mesh (MediaPipe indices). */
export function earFromHumanFace(face: FaceResult): { leftEar: number; rightEar: number } {
  const mesh = face.mesh as MeshPoint[] | undefined
  if (mesh && mesh.length >= 400) {
    const leftPoints = LEFT_EYE_INDICES.map((i) => asPoint(mesh[i])).filter(
      (p): p is { x: number; y: number } => !!p,
    )
    const rightPoints = RIGHT_EYE_INDICES.map((i) => asPoint(mesh[i])).filter(
      (p): p is { x: number; y: number } => !!p,
    )
    if (leftPoints.length === 6 && rightPoints.length === 6) {
      return {
        leftEar: eyeAspectRatio(leftPoints, [0, 1, 2, 3, 4, 5]),
        rightEar: eyeAspectRatio(rightPoints, [0, 1, 2, 3, 4, 5]),
      }
    }
  }

  // Fallback: annotation contours when mesh points are incomplete.
  const annotations = face.annotations as Record<string, MeshPoint[]> | undefined
  const leftAnn = annotations?.leftEye ?? annotations?.leftEyeUpper0
  const rightAnn = annotations?.rightEye ?? annotations?.rightEyeUpper0
  if (leftAnn && rightAnn && leftAnn.length >= 6 && rightAnn.length >= 6) {
    const sample = (pts: MeshPoint[]) => {
      const step = Math.max(1, Math.floor(pts.length / 6))
      return [0, 1, 2, 3, 4, 5].map((i) => asPoint(pts[Math.min(pts.length - 1, i * step)])!)
    }
    const leftPoints = sample(leftAnn)
    const rightPoints = sample(rightAnn)
    return {
      leftEar: eyeAspectRatio(leftPoints, [0, 1, 2, 3, 4, 5]),
      rightEar: eyeAspectRatio(rightPoints, [0, 1, 2, 3, 4, 5]),
    }
  }

  return { leftEar: 0.3, rightEar: 0.3 }
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
    fw < width * 0.92 &&
    fh > height * 0.14 &&
    fh < height * 0.92
  )
}

const DETECT_MAX_SIDE = 512

function sourceSize(source: HTMLVideoElement | HTMLCanvasElement) {
  if ('videoWidth' in source) {
    return {
      width: source.videoWidth || source.clientWidth,
      height: source.videoHeight || source.clientHeight,
    }
  }
  return { width: source.width, height: source.height }
}

/** Downscale large camera frames before detect — mesh+antispoof on 1280px is slow. */
function prepareDetectInput(source: HTMLVideoElement | HTMLCanvasElement) {
  const { width, height } = sourceSize(source)
  const maxSide = Math.max(width, height)
  if (maxSide <= DETECT_MAX_SIDE || width <= 0 || height <= 0) {
    return { input: source, width, height }
  }

  const scale = DETECT_MAX_SIDE / maxSide
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  if (!detectCanvas) detectCanvas = document.createElement('canvas')
  detectCanvas.width = w
  detectCanvas.height = h
  const ctx = detectCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { input: source, width, height }
  ctx.drawImage(source, 0, 0, w, h)
  return { input: detectCanvas, width: w, height: h }
}

/**
 * Run one Human detection pass for liveness + anti-spoof (+ periodic gender).
 * Blink uses continuous mesh EAR — not momentary Human blink gestures.
 */
export async function detectHumanLivenessFrame(
  source: HTMLVideoElement | HTMLCanvasElement,
  options?: { forceGender?: boolean },
): Promise<HumanLivenessFrame> {
  const human = await getHuman()
  frameSeq += 1
  // Gender description is heavy — sample every 6th frame unless forced at submit.
  const needGender = options?.forceGender || frameSeq % 6 === 1
  if (human.config.face?.description) {
    human.config.face.description.enabled = needGender
  }

  const { input, width, height } = prepareDetectInput(source)
  const result: Result = await human.detect(input)
  const face = result.face?.[0]
  const gestures = (result.gesture ?? []).map((g) => String(g.gesture))

  if (!face) {
    return {
      faceDetected: false,
      faceCentered: false,
      facingCamera: true,
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
      gestures,
    }
  }

  const box = boxFromFace(face)
  const { leftEar, rightEar } = earFromHumanFace(face)
  const avgEar = (leftEar + rightEar) / 2
  const eyesClosed = avgEar < GENDER_VERIFICATION.earBlinkThreshold

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
    facingCamera: true,
    eyesClosed,
    blinkLeft: eyesClosed,
    blinkRight: eyesClosed,
    leftEar,
    rightEar,
    avgEar,
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
