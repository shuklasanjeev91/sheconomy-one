import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection'
import * as tf from '@tensorflow/tfjs'

import '@tensorflow/tfjs-backend-webgl'

let detectorPromise: Promise<faceLandmarksDetection.FaceLandmarksDetector> | null = null

export async function getFaceLandmarksDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      await tf.setBackend('webgl')
      await tf.ready()
      return faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        {
          runtime: 'tfjs',
          refineLandmarks: true,
          maxFaces: 1,
        },
      )
    })()
  }

  return detectorPromise
}

export type DetectedFaceFrame = {
  keypoints: Array<{ x: number; y: number; z?: number }>
  box: { xMin: number; xMax: number; yMin: number; yMax: number }
}

export async function detectFaceFrame(
  source: HTMLVideoElement | HTMLCanvasElement,
): Promise<DetectedFaceFrame | null> {
  const detector = await getFaceLandmarksDetector()
  const faces = await detector.estimateFaces(source, { flipHorizontal: false })

  if (!faces.length) return null

  const face = faces[0]
  const keypoints = face.keypoints.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z,
  }))

  const xs = keypoints.map((point) => point.x)
  const ys = keypoints.map((point) => point.y)

  return {
    keypoints,
    box: {
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: Math.min(...ys),
      yMax: Math.max(...ys),
    },
  }
}
