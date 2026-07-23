import { GENDER_VERIFICATION } from './constants'
import type { GenderEstimate } from './constants'

type Point = { x: number; y: number }

let faceApiModulePromise: Promise<typeof import('@vladmandic/face-api')> | null = null

async function getFaceApi() {
  if (!faceApiModulePromise) {
    faceApiModulePromise = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      const base = GENDER_VERIFICATION.faceApiModelBaseUrl
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(base),
        faceapi.nets.ssdMobilenetv1.loadFromUri(base),
        faceapi.nets.faceLandmark68Net.loadFromUri(base),
        faceapi.nets.ageGenderNet.loadFromUri(base),
      ])
      return faceapi
    })()
  }

  return faceApiModulePromise
}

/** Preload models so Start verification is instant. */
export async function preloadFaceApiModels() {
  await getFaceApi()
}

function eyeAspectRatioFromContour(points: Point[]) {
  if (points.length < 6) return 1
  const [p1, p2, p3, p4, p5, p6] = points
  const vertical =
    Math.hypot(p2.x - p6.x, p2.y - p6.y) + Math.hypot(p3.x - p5.x, p3.y - p5.y)
  const horizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y) * 2
  if (horizontal <= 0) return 1
  return vertical / horizontal
}

export type FaceLivenessFrame = {
  box: { xMin: number; xMax: number; yMin: number; yMax: number }
  leftEar: number
  rightEar: number
  avgEar: number
  gender: GenderEstimate | null
}

/**
 * Fast per-frame face + eye openness via @vladmandic/face-api
 * (TinyFaceDetector + 68 landmarks). Used for natural-blink liveness on web.
 */
export async function analyzeLivenessFrame(
  source: HTMLVideoElement | HTMLCanvasElement,
  options?: { includeGender?: boolean },
): Promise<FaceLivenessFrame | null> {
  const faceapi = await getFaceApi()
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.45,
  })

  const detection = options?.includeGender
    ? await faceapi
        .detectSingleFace(source, detectorOptions)
        .withFaceLandmarks()
        .withAgeAndGender()
    : await faceapi.detectSingleFace(source, detectorOptions).withFaceLandmarks()

  if (!detection) return null

  const box = detection.detection.box
  const leftEye = detection.landmarks.getLeftEye() as Point[]
  const rightEye = detection.landmarks.getRightEye() as Point[]
  const leftEar = eyeAspectRatioFromContour(leftEye)
  const rightEar = eyeAspectRatioFromContour(rightEye)

  let gender: GenderEstimate | null = null
  if (options?.includeGender && 'gender' in detection && detection.gender) {
    gender = {
      isFemale: detection.gender === 'female',
      confidence: Number((detection as { genderProbability: number }).genderProbability.toFixed(3)),
    }
  }

  return {
    box: {
      xMin: box.x,
      xMax: box.x + box.width,
      yMin: box.y,
      yMax: box.y + box.height,
    },
    leftEar,
    rightEar,
    avgEar: (leftEar + rightEar) / 2,
    gender,
  }
}

export async function estimateGenderFromVideo(
  video: HTMLVideoElement,
): Promise<GenderEstimate | null> {
  const faceapi = await getFaceApi()

  const detection = await faceapi
    .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
    .withFaceLandmarks()
    .withAgeAndGender()

  if (!detection) return null

  return {
    isFemale: detection.gender === 'female',
    confidence: Number(detection.genderProbability.toFixed(3)),
  }
}

export async function estimateGenderFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<GenderEstimate | null> {
  const faceapi = await getFaceApi()

  const detection = await faceapi
    .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
    .withFaceLandmarks()
    .withAgeAndGender()

  if (!detection) return null

  return {
    isFemale: detection.gender === 'female',
    confidence: Number(detection.genderProbability.toFixed(3)),
  }
}
