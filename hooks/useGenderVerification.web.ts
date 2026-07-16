import { useCallback, useEffect, useRef, useState } from 'react'

import {
  GENDER_VERIFICATION,
  type FaceTrackingStatus,
  type VerificationPhase,
  completeGenderVerificationSession,
  computeLivenessScore,
  createGenderVerificationSession,
  createGestureBlinkTracker,
  detectHumanLivenessFrame,
  passesAntiSpoof,
  preloadHumanModels,
  updateGestureBlinkTracker,
} from '~/lib/gender-verification'

import { BRAND_NAME } from '~/config/brand'

type UseGenderVerificationOptions = {
  onVerified?: () => void
}

export function useGenderVerification({ onVerified }: UseGenderVerificationOptions = {}) {
  const [phase, setPhase] = useState<VerificationPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blinkCount, setBlinkCount] = useState(0)
  const [instruction, setInstruction] = useState('Start when you are ready')
  const [tracking, setTracking] = useState<FaceTrackingStatus>({
    faceDetected: false,
    faceCentered: false,
    eyesClosed: false,
    calibrated: true,
    avgEar: null,
    liveScore: 0,
    realScore: 0,
    facingCamera: false,
  })
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopActiveRef = useRef(false)
  const blinkTrackerRef = useRef(createGestureBlinkTracker())
  const stableFramesRef = useRef(0)
  const liveSamplesRef = useRef<number[]>([])
  const realSamplesRef = useRef<number[]>([])
  const analyzingRef = useRef(false)
  const sessionIdRef = useRef<string | null>(null)
  const loopGenerationRef = useRef(0)
  const lastGenderRef = useRef<{ isFemale: boolean; confidence: number } | null>(null)

  const stopCamera = useCallback(() => {
    loopGenerationRef.current += 1
    loopActiveRef.current = false
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  useEffect(() => {
    void preloadHumanModels().catch(() => undefined)
  }, [])

  const mountVideo = useCallback(() => {
    if (!containerRef.current) return
    if (videoRef.current && containerRef.current.contains(videoRef.current)) return

    if (videoRef.current) {
      videoRef.current.remove()
      videoRef.current = null
    }

    const video = document.createElement('video')
    video.autoplay = true
    video.playsInline = true
    video.muted = true
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.style.width = '100%'
    video.style.height = '100%'
    video.style.objectFit = 'cover'
    video.style.transform = 'scaleX(-1)'
    containerRef.current.appendChild(video)
    videoRef.current = video
  }, [])

  const analyzeAndSubmit = useCallback(
    async (detectedBlinks: number, livenessScore: number) => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || analyzingRef.current) return
      analyzingRef.current = true
      loopActiveRef.current = false
      setPhase('analyze')
      setInstruction('Confirming you are a live person…')

      try {
        const avgLive =
          liveSamplesRef.current.reduce((a, b) => a + b, 0) /
          Math.max(1, liveSamplesRef.current.length)
        const avgReal =
          realSamplesRef.current.reduce((a, b) => a + b, 0) /
          Math.max(1, realSamplesRef.current.length)

        if (!passesAntiSpoof(avgLive, avgReal)) {
          throw new Error(
            'We could not confirm a live face. Avoid photos or screens — look at the camera and blink naturally.',
          )
        }

        const gender = lastGenderRef.current
        if (!gender) {
          throw new Error('Could not analyze your face. Try again in good lighting.')
        }
        if (!gender.isFemale || gender.confidence < GENDER_VERIFICATION.minGenderConfidence) {
          throw new Error(
            `${BRAND_NAME} is women-first. Verification did not meet the required confidence.`,
          )
        }

        const { result, error: submitError } = await completeGenderVerificationSession({
          sessionId: activeSessionId,
          detectedBlinks,
          livenessScore: Math.max(livenessScore, avgLive),
          genderDetected: gender.isFemale,
          genderConfidence: gender.confidence,
        })

        if (submitError) throw new Error(submitError)
        if (!result?.ok) throw new Error(result?.message ?? 'Verification failed.')

        stopCamera()
        setPhase('success')
        setInstruction('Verified successfully')
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
    [onVerified, stopCamera],
  )

  const runDetectionLoop = useCallback(async () => {
    const generation = loopGenerationRef.current

    while (loopActiveRef.current && generation === loopGenerationRef.current) {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        await new Promise((r) => setTimeout(r, 40))
        continue
      }

      try {
        const frame = await detectHumanLivenessFrame(video)
        if (!loopActiveRef.current || generation !== loopGenerationRef.current) return

        setTracking({
          faceDetected: frame.faceDetected,
          faceCentered: frame.faceCentered,
          eyesClosed: frame.eyesClosed,
          calibrated: true,
          avgEar: null,
          liveScore: frame.liveScore,
          realScore: frame.realScore,
          facingCamera: frame.facingCamera,
        })

        if (!frame.faceDetected) {
          stableFramesRef.current = 0
          setPhase('position')
          setInstruction('Position your face in the circle')
          await new Promise((r) => setTimeout(r, 40))
          continue
        }

        if (!frame.faceCentered) {
          stableFramesRef.current = 0
          setPhase('position')
          setInstruction('Move closer and center your face')
          await new Promise((r) => setTimeout(r, 35))
          continue
        }

        if (frame.gender) lastGenderRef.current = frame.gender
        liveSamplesRef.current = [...liveSamplesRef.current.slice(-24), frame.liveScore]
        realSamplesRef.current = [...realSamplesRef.current.slice(-24), frame.realScore]
        stableFramesRef.current += 1
        setPhase('blink')

        const tracker = updateGestureBlinkTracker(
          blinkTrackerRef.current,
          frame.eyesClosed,
          Date.now(),
        )
        blinkTrackerRef.current = tracker
        setBlinkCount(tracker.count)

        const remaining = Math.max(0, GENDER_VERIFICATION.requiredBlinks - tracker.count)
        if (remaining > 0) {
          setInstruction(
            frame.eyesClosed
              ? 'Open your eyes'
              : `Blink naturally — ${remaining} left`,
          )
          await new Promise((r) => setTimeout(r, 25))
          continue
        }

        const livenessScore = computeLivenessScore({
          detectedBlinks: tracker.count,
          requiredBlinks: GENDER_VERIFICATION.requiredBlinks,
          faceCentered: true,
          stableFrames: stableFramesRef.current,
          minStableFrames: 8,
        })

        await analyzeAndSubmit(tracker.count, livenessScore)
        return
      } catch {
        if (generation !== loopGenerationRef.current) return
        setError('Face tracking interrupted. Please try again.')
        setPhase('error')
        stopCamera()
        return
      }
    }
  }, [analyzeAndSubmit, stopCamera])

  const start = useCallback(async () => {
    if (!supported) {
      setError('Camera access is required for verification.')
      setPhase('error')
      return
    }

    setError(null)
    setPhase('loading')
    setInstruction('Loading secure face models…')
    blinkTrackerRef.current = createGestureBlinkTracker()
    stableFramesRef.current = 0
    liveSamplesRef.current = []
    realSamplesRef.current = []
    lastGenderRef.current = null
    setBlinkCount(0)
    analyzingRef.current = false
    sessionIdRef.current = null

    try {
      await preloadHumanModels()
    } catch {
      setError('Could not load face models. Check your connection and retry.')
      setPhase('error')
      return
    }

    const { sessionId: createdSessionId, error: sessionError } =
      await createGenderVerificationSession()
    if (sessionError || !createdSessionId) {
      setError(sessionError ?? 'Could not start verification session.')
      setPhase('error')
      return
    }
    sessionIdRef.current = createdSessionId
    mountVideo()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Camera preview failed to initialize.')
      video.srcObject = stream
      await video.play()

      setPhase('camera')
      setInstruction('Center your face, then blink naturally')
      loopActiveRef.current = true
      void runDetectionLoop()
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
    if (videoRef.current) {
      videoRef.current.remove()
      videoRef.current = null
    }
    sessionIdRef.current = null
    setBlinkCount(0)
    setError(null)
    setPhase('idle')
    setInstruction('Start when you are ready')
    blinkTrackerRef.current = createGestureBlinkTracker()
    stableFramesRef.current = 0
    analyzingRef.current = false
    setTracking({
      faceDetected: false,
      faceCentered: false,
      eyesClosed: false,
      calibrated: true,
      avgEar: null,
      liveScore: 0,
      realScore: 0,
      facingCamera: false,
    })
  }, [stopCamera])

  return {
    supported,
    phase,
    error,
    instruction,
    blinkCount,
    requiredBlinks: GENDER_VERIFICATION.requiredBlinks,
    tracking,
    containerRef,
    start,
    reset,
  }
}
