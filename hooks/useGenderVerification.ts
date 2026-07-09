import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import {
  GENDER_VERIFICATION,
  LEFT_EYE_INDICES,
  RIGHT_EYE_INDICES,
  type VerificationPhase,
  completeGenderVerificationSession,
  computeLivenessScore,
  createBlinkTracker,
  createGenderVerificationSession,
  detectFaceFrame,
  estimateGenderFromVideo,
  eyeAspectRatio,
  isFaceCentered,
  updateBlinkTracker,
} from '~/lib/gender-verification'

import { BRAND_NAME } from '~/config/brand'

type UseGenderVerificationOptions = {
  onVerified?: () => void
}

export function useGenderVerification({ onVerified }: UseGenderVerificationOptions = {}) {
  const [phase, setPhase] = useState<VerificationPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [blinkCount, setBlinkCount] = useState(0)
  const [instruction, setInstruction] = useState('Prepare for face verification')
  const [supported] = useState(() => Platform.OS === 'web' && typeof navigator !== 'undefined')

  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const blinkTrackerRef = useRef(createBlinkTracker())
  const stableFramesRef = useRef(0)
  const analyzingRef = useRef(false)

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  const mountVideo = useCallback(() => {
    if (Platform.OS !== 'web' || !containerRef.current || videoRef.current) return

    const video = document.createElement('video')
    video.autoplay = true
    video.playsInline = true
    video.muted = true
    video.setAttribute('playsinline', 'true')
    video.style.width = '100%'
    video.style.height = '100%'
    video.style.objectFit = 'cover'
    video.style.transform = 'scaleX(-1)'
    containerRef.current.appendChild(video)
    videoRef.current = video
  }, [])

  const analyzeAndSubmit = useCallback(
    async (detectedBlinks: number, livenessScore: number) => {
      if (!sessionId || analyzingRef.current) return
      analyzingRef.current = true
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setPhase('analyze')
      setInstruction('Analyzing your verification…')

      try {
        const video = videoRef.current
        if (!video) throw new Error('Camera is not ready.')

        const gender = await estimateGenderFromVideo(video)
        if (!gender) {
          throw new Error('Could not analyze your face. Please try again in good lighting.')
        }

        if (!gender.isFemale || gender.confidence < GENDER_VERIFICATION.minGenderConfidence) {
          throw new Error(
            `${BRAND_NAME} community access is available to women. Verification did not meet the required confidence.`,
          )
        }

        const { result, error: submitError } = await completeGenderVerificationSession({
          sessionId,
          detectedBlinks,
          livenessScore,
          genderDetected: gender.isFemale,
          genderConfidence: gender.confidence,
        })

        if (submitError) throw new Error(submitError)
        if (!result?.ok) throw new Error(result?.message ?? 'Verification failed.')

        stopCamera()
        setPhase('success')
        setInstruction('Verification successful!')
        onVerified?.()
      } catch (submitFailure) {
        const message =
          submitFailure instanceof Error ? submitFailure.message : 'Verification failed.'
        setError(message)
        setPhase('error')
        setInstruction(message)
        stopCamera()
      } finally {
        analyzingRef.current = false
      }
    },
    [onVerified, sessionId, stopCamera],
  )

  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runDetectionLoop)
      return
    }

    void (async () => {
      try {
        const face = await detectFaceFrame(video)

        if (!face) {
          stableFramesRef.current = 0
          setInstruction('Center your face inside the oval')
          setPhase('position')
          rafRef.current = requestAnimationFrame(runDetectionLoop)
          return
        }

        const width = video.videoWidth || video.clientWidth
        const height = video.videoHeight || video.clientHeight
        const centered = isFaceCentered(face.box, width, height)

        if (!centered) {
          stableFramesRef.current = 0
          setPhase('position')
          setInstruction('Move closer and align your face in the oval')
          rafRef.current = requestAnimationFrame(runDetectionLoop)
          return
        }

        stableFramesRef.current += 1
        setPhase('blink')

        const leftEar = eyeAspectRatio(face.keypoints, LEFT_EYE_INDICES)
        const rightEar = eyeAspectRatio(face.keypoints, RIGHT_EYE_INDICES)
        const tracker = updateBlinkTracker(
          blinkTrackerRef.current,
          leftEar,
          rightEar,
          GENDER_VERIFICATION.earBlinkThreshold,
          GENDER_VERIFICATION.earOpenThreshold,
        )
        blinkTrackerRef.current = tracker
        setBlinkCount(tracker.count)

        const remaining = Math.max(0, GENDER_VERIFICATION.requiredBlinks - tracker.count)
        if (remaining > 0) {
          setInstruction(`Blink naturally ${remaining} more time${remaining === 1 ? '' : 's'}`)
          rafRef.current = requestAnimationFrame(runDetectionLoop)
          return
        }

        const livenessScore = computeLivenessScore({
          detectedBlinks: tracker.count,
          requiredBlinks: GENDER_VERIFICATION.requiredBlinks,
          faceCentered: centered,
          stableFrames: stableFramesRef.current,
          minStableFrames: 12,
        })

        if (livenessScore < GENDER_VERIFICATION.minLivenessScore) {
          setInstruction('Hold still for a moment, then blink again')
          blinkTrackerRef.current = createBlinkTracker()
          setBlinkCount(0)
          stableFramesRef.current = 0
          rafRef.current = requestAnimationFrame(runDetectionLoop)
          return
        }

        await analyzeAndSubmit(tracker.count, livenessScore)
      } catch {
        setError('Face tracking was interrupted. Please try again.')
        setPhase('error')
        stopCamera()
      }
    })()
  }, [analyzeAndSubmit, stopCamera])

  const start = useCallback(async () => {
    if (!supported) {
      setError('Face verification is currently supported on web browsers.')
      setPhase('error')
      return
    }

    setError(null)
    setPhase('loading')
    setInstruction('Starting secure verification…')
    blinkTrackerRef.current = createBlinkTracker()
    stableFramesRef.current = 0
    setBlinkCount(0)
    analyzingRef.current = false

    const { sessionId: createdSessionId, error: sessionError } =
      await createGenderVerificationSession()

    if (sessionError || !createdSessionId) {
      setError(sessionError ?? 'Could not start verification session.')
      setPhase('error')
      return
    }

    setSessionId(createdSessionId)
    mountVideo()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Camera preview failed to initialize.')

      video.srcObject = stream
      await video.play()

      setPhase('camera')
      setInstruction('Center your face inside the oval')
      rafRef.current = requestAnimationFrame(runDetectionLoop)
    } catch (cameraError) {
      const message =
        cameraError instanceof Error
          ? cameraError.message
          : 'Camera permission is required for liveness verification.'
      setError(message)
      setPhase('error')
      stopCamera()
    }
  }, [mountVideo, runDetectionLoop, stopCamera, supported])

  const reset = useCallback(() => {
    stopCamera()
    if (containerRef.current) containerRef.current.innerHTML = ''
    videoRef.current = null
    setSessionId(null)
    setBlinkCount(0)
    setError(null)
    setPhase('idle')
    setInstruction('Prepare for face verification')
    blinkTrackerRef.current = createBlinkTracker()
    stableFramesRef.current = 0
    analyzingRef.current = false
  }, [stopCamera])

  return {
    supported,
    phase,
    error,
    instruction,
    blinkCount,
    requiredBlinks: GENDER_VERIFICATION.requiredBlinks,
    containerRef,
    start,
    reset,
  }
}
