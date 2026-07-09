import * as faceapi from '@vladmandic/face-api'

import { GENDER_VERIFICATION } from './constants'
import type { GenderEstimate } from './constants'

let modelsPromise: Promise<void> | null = null

async function loadGenderModels() {
  if (!modelsPromise) {
    modelsPromise = (async () => {
      const base = GENDER_VERIFICATION.faceApiModelBaseUrl
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(base),
        faceapi.nets.faceLandmark68Net.loadFromUri(base),
        faceapi.nets.ageGenderNet.loadFromUri(base),
      ])
    })()
  }

  return modelsPromise
}

export async function estimateGenderFromVideo(
  video: HTMLVideoElement,
): Promise<GenderEstimate | null> {
  await loadGenderModels()

  const detection = await faceapi
    .detectSingleFace(video)
    .withFaceLandmarks()
    .withAgeAndGender()

  if (!detection) return null

  const isFemale = detection.gender === 'female'
  const confidence = detection.genderProbability

  return {
    isFemale,
    confidence: Number(confidence.toFixed(3)),
  }
}

export async function estimateGenderFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<GenderEstimate | null> {
  await loadGenderModels()

  const detection = await faceapi
    .detectSingleFace(canvas)
    .withFaceLandmarks()
    .withAgeAndGender()

  if (!detection) return null

  return {
    isFemale: detection.gender === 'female',
    confidence: Number(detection.genderProbability.toFixed(3)),
  }
}
