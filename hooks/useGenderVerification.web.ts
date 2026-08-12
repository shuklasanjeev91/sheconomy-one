import { useCallback, useEffect, useRef, useState } from 'react'

import {
  GENDER_ERROR_CODES,
  GENDER_VERIFICATION,
  type FaceTrackingStatus,
  type GenderSample,
  type VerificationPhase,
  completeGenderVerificationSession,
  computeLivenessScore,
  createBlinkTracker,
  createEarCalibrator,
  createGenderVerificationError,
  createGenderVerificationSession,
  detectHumanLivenessFrame,
  passesAntiSpoof,
  preloadHumanModels,
  summarizeGenderSamples,
  thresholdsFromBaseline,
  updateBlinkTracker,
  updateEarCalibrator,
} from '~/lib/gender-verification'

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
    calibrated: false,
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
  const blinkTrackerRef = useRef(createBlinkTracker())
  const earCalibratorRef = useRef(createEarCalibrator())
  const stableFramesRef = useRef(0)
  const liveSamplesRef = useRef<number[]>([])
  const realSamplesRef = useRef<number[]>([])
  const analyzingRef = useRef(false)
  const sessionIdRef = useRef<string | null>(null)
  const loopGenerationRef = useRef(0)
  const genderSamplesRef = useRef<GenderSample[]>([])
  /** 'gender' is the follow-up round: blinks are done, we only need more reads. */
  const samplingModeRef = useRef<'blink' | 'gender'>('blink')
  const extraRoundUsedRef = useRef(false)
  const extraRoundDeadlineRef = useRef(0)

  /** Keep a bounded window of reads — a long session should not grow unbounded. */
  const pushGenderSample = useCallback((sample: GenderSample) => {
    genderSamplesRef.current = [...genderSamplesRef.current.slice(-39), sample]
  }, [])

  /** In the follow-up round, wait for the extra reads (or the time cap) before judging. */
  const readyToJudgeGender = useCallback(() => {
    if (samplingModeRef.current !== 'gender') return true
    const target = GENDER_VERIFICATION.minGenderSamples + GENDER_VERIFICATION.extraGenderSamples
    return (
      genderSamplesRef.current.length >= target || Date.now() >= extraRoundDeadlineRef.current
    )
  }, [])

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
    async (detectedBlinks: number, livenessScore: number): Promise<'resume' | 'done'> => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || analyzingRef.current) return 'done'
      analyzingRef.current = true
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

        // One last dedicated read of the live frame, added to the session samples.
        const video = videoRef.current
        if (video) {
          const frame = await detectHumanLivenessFrame(video, { forceGender: true })
          if (frame.gender) pushGenderSample(frame.gender)
        }

        const verdict = summarizeGenderSamples(genderSamplesRef.current, {
          minSamples: GENDER_VERIFICATION.minGenderSamples,
          threshold: GENDER_VERIFICATION.minGenderConfidence,
          borderlineBand: GENDER_VERIFICATION.genderBorderlineBand,
        })

        if (verdict.status === 'insufficient' && !extraRoundUsedRef.current) {
          extraRoundUsedRef.current = true
          samplingModeRef.current = 'gender'
          extraRoundDeadlineRef.current = Date.now() + GENDER_VERIFICATION.extraGenderSamplingMs
          setPhase('blink')
          setInstruction('Almost there — hold still and look at the camera')
          return 'resume'
        }

        if (verdict.status === 'insufficient' || verdict.femaleScore == null) {
          throw createGenderVerificationError(GENDER_ERROR_CODES.LOW_CONFIDENCE_RETRY)
        }

        if (verdict.status === 'fail') {
          throw createGenderVerificationError(GENDER_ERROR_CODES.NOT_ELIGIBLE)
        }

        const { result, error: submitError } = await completeGenderVerificationSession({
          sessionId: activeSessionId,
          detectedBlinks,
          livenessScore: Math.max(livenessScore, avgLive),
          genderDetected: true,
          genderConfidence: verdict.femaleScore,
        })

        if (submitError) throw new Error(submitError)
        if (!result?.ok) throw new Error(result?.message ?? 'Verification failed.')

        stopCamera()
        setPhase('success')
        setInstruction('Verified successfully')
        onVerified?.()
        return 'done'
      } catch (submitFailure) {
        const message =
          submitFailure instanceof Error ? submitFailure.message : 'Verification failed.'
        setError(message)
        setPhase('error')
        setInstruction(message)
        stopCamera()
        return 'done'
      } finally {
        analyzingRef.current = false
      }
    },
    [onVerified, pushGenderSample, stopCamera],
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
        const frame = await detectHumanLivenessFrame(video, {
          forceGender: samplingModeRef.current === 'gender',
        })
        if (!loopActiveRef.current || generation !== loopGenerationRef.current) return

        updateEarCalibrator(earCalibratorRef.current, frame.avgEar, 10)
        const thresholds = thresholdsFromBaseline(
          earCalibratorRef.current.baseline,
          GENDER_VERIFICATION.earBlinkThreshold,
          GENDER_VERIFICATION.earOpenThreshold,
        )
        const eyesClosed = frame.avgEar < thresholds.blinkThreshold

        setTracking({
          faceDetected: frame.faceDetected,
          faceCentered: frame.faceCentered,
          eyesClosed,
          calibrated: thresholds.calibrated,
          avgEar: frame.avgEar,
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

        if (frame.gender) pushGenderSample(frame.gender)
        if (frame.liveScore > 0) {
          liveSamplesRef.current = [...liveSamplesRef.current.slice(-24), frame.liveScore]
        }
        if (frame.realScore > 0) {
          realSamplesRef.current = [...realSamplesRef.current.slice(-24), frame.realScore]
        }
        stableFramesRef.current += 1
        setPhase('blink')

        const tracker = updateBlinkTracker(blinkTrackerRef.current, frame.leftEar, frame.rightEar, {
          blinkThreshold: thresholds.blinkThreshold,
          openThreshold: thresholds.openThreshold,
          minClosedMs: GENDER_VERIFICATION.minClosedMs,
          maxClosedMs: GENDER_VERIFICATION.maxClosedMs,
          minBlinkGapMs: GENDER_VERIFICATION.minBlinkGapMs,
        })
        blinkTrackerRef.current = tracker
        setBlinkCount(tracker.count)

        const remaining = Math.max(0, GENDER_VERIFICATION.requiredBlinks - tracker.count)
        if (remaining > 0) {
          setInstruction(
            eyesClosed
              ? 'Open your eyes'
              : `Blink naturally — ${remaining} left`,
          )
          await new Promise((r) => setTimeout(r, 16))
          continue
        }

        if (!readyToJudgeGender()) {
          setInstruction('Almost there — hold still and look at the camera')
          await new Promise((r) => setTimeout(r, 16))
          continue
        }

        const livenessScore = computeLivenessScore({
          detectedBlinks: tracker.count,
          requiredBlinks: GENDER_VERIFICATION.requiredBlinks,
          faceCentered: true,
          stableFrames: stableFramesRef.current,
          minStableFrames: 8,
        })

        const outcome = await analyzeAndSubmit(tracker.count, livenessScore)
        if (outcome === 'resume') continue
        return
      } catch {
        if (generation !== loopGenerationRef.current) return
        setError('Face tracking interrupted. Please try again.')
        setPhase('error')
        stopCamera()
        return
      }
    }
  }, [analyzeAndSubmit, pushGenderSample, readyToJudgeGender, stopCamera])

  const start = useCallback(async () => {
    if (!supported) {
      setError('Camera access is required for verification.')
      setPhase('error')
      return
    }

    setError(null)
    setPhase('loading')
    setInstruction('Loading secure face models…')
    blinkTrackerRef.current = createBlinkTracker()
    earCalibratorRef.current = createEarCalibrator()
    stableFramesRef.current = 0
    liveSamplesRef.current = []
    realSamplesRef.current = []
    genderSamplesRef.current = []
    samplingModeRef.current = 'blink'
    extraRoundUsedRef.current = false
    extraRoundDeadlineRef.current = 0
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
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
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
    blinkTrackerRef.current = createBlinkTracker()
    earCalibratorRef.current = createEarCalibrator()
    stableFramesRef.current = 0
    liveSamplesRef.current = []
    realSamplesRef.current = []
    genderSamplesRef.current = []
    samplingModeRef.current = 'blink'
    extraRoundUsedRef.current = false
    extraRoundDeadlineRef.current = 0
    analyzingRef.current = false
    setTracking({
      faceDetected: false,
      faceCentered: false,
      eyesClosed: false,
      calibrated: false,
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
