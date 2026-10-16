import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking } from 'react-native'
import type { CameraView } from 'expo-camera'
import { Camera, useCameraPermissions } from 'expo-camera'

import type { NativeFaceAnalyzerHandle } from '~/components/gender-verification/NativeFaceAnalyzer'
import {
  FACE_QUALITY,
  GENDER_ERROR_CODES,
  GENDER_VERIFICATION,
  type FaceTrackingStatus,
  type GenderSample,
  type VerificationDiagnostics,
  type VerificationPhase,
  assessFaceQuality,
  blocksGenderSample,
  computeLivenessScore,
  createFaceQualitySmoother,
  createFaceQualityTally,
  faceQualityHint,
  medianAge,
  recordFaceQuality,
  reportedFaceQualityIssues,
  shouldRetryForQuality,
  smoothFaceQuality,
  createBlinkTracker,
  createEarCalibrator,
  createGenderVerificationError,
  createGenderVerificationSession,
  GENDER_ERROR_INSTRUCTIONS,
  getGenderErrorInstruction,
  isFaceCentered,
  isSoftRetryableGenderError,
  passesAntiSpoof,
  stepBlinkLiveness,
  submitGenderVerificationSession,
  summarizeGenderSamples,
} from '~/lib/gender-verification'

type UseGenderVerificationOptions = {
  onVerified?: () => void
  /** Phone opened this attempt from a desktop QR code. */
  handoffToken?: string | null
}

export function useGenderVerification({ onVerified, handoffToken }: UseGenderVerificationOptions = {}) {
  const handoffTokenRef = useRef(handoffToken)
  handoffTokenRef.current = handoffToken
  const [phase, setPhase] = useState<VerificationPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [blinkCount, setBlinkCount] = useState(0)
  const [instruction, setInstruction] = useState('Start when you are ready')
  const [analyzerReady, setAnalyzerReady] = useState(false)
  const [diagnostics, setDiagnostics] = useState<VerificationDiagnostics | null>(null)
  const [tracking, setTracking] = useState<FaceTrackingStatus>({
    faceDetected: false,
    faceCentered: false,
    eyesClosed: false,
    calibrated: false,
    avgEar: null,
    liveScore: 0,
    realScore: 0,
  })
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  /** Local grant flag — hook state can lag one render behind `requestCameraPermissionsAsync`. */
  const [cameraGranted, setCameraGranted] = useState(false)

  const cameraRef = useRef<CameraView | null>(null)
  const analyzerRef = useRef<NativeFaceAnalyzerHandle | null>(null)
  const blinkTrackerRef = useRef(createBlinkTracker())
  const earCalibratorRef = useRef(createEarCalibrator())
  const stableFramesRef = useRef(0)
  /** When the blink prompt first showed, to suggest a slower blink if none is seen. */
  const blinkPromptAtRef = useRef<number | null>(null)
  const liveSamplesRef = useRef<number[]>([])
  const realSamplesRef = useRef<number[]>([])
  const genderSamplesRef = useRef<GenderSample[]>([])
  const qualitySmootherRef = useRef(
    createFaceQualitySmoother(FACE_QUALITY.nativeWindow, FACE_QUALITY.nativeMinHits),
  )
  const qualityTallyRef = useRef(createFaceQualityTally())
  /** Survives start() so quality retries cannot loop forever; only Reset clears it. */
  const qualityRetriesRef = useRef(0)
  const frameSeqRef = useRef(0)
  /** 'gender' is the follow-up round: blinks are done, we only need more reads. */
  const samplingModeRef = useRef<'blink' | 'gender'>('blink')
  const extraRoundUsedRef = useRef(false)
  const extraRoundDeadlineRef = useRef(0)
  const analyzingRef = useRef(false)
  const processingRef = useRef(false)
  const loopActiveRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  /** Bumped by every start so frames and submits from an earlier run go nowhere. */
  const runIdRef = useRef(0)
  const startingRef = useRef(false)
  const cameraReadyRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const stopCaptureLoop = useCallback(() => {
    loopActiveRef.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => stopCaptureLoop, [stopCaptureLoop])

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

  useEffect(() => {
    if (cameraPermission?.granted) setCameraGranted(true)
  }, [cameraPermission?.granted])

  const openCameraSettings = useCallback(() => {
    void Linking.openSettings()
  }, [])

  const ensureCameraPermission = useCallback(async () => {
    // Prefer the imperative API (same as Co-Work) so the system sheet always runs
    // from this user gesture, even if the hook state is stale.
    if (cameraPermission?.granted || cameraGranted) {
      setCameraGranted(true)
      return cameraPermission ?? { granted: true, canAskAgain: true, status: 'granted' as const }
    }

    const permission = await Camera.requestCameraPermissionsAsync()
    if (permission.granted) {
      setCameraGranted(true)
      try {
        await requestCameraPermission()
      } catch {
        // ignore — Camera.request already returned the definitive result
      }
    }
    return permission
  }, [cameraGranted, cameraPermission, requestCameraPermission])

  const analyzeAndSubmit = useCallback(
    async (
      detectedBlinks: number,
      livenessScore: number,
      base64: string,
      width: number,
      height: number,
    ): Promise<'resume' | 'done'> => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || analyzingRef.current) return 'done'
      const runId = runIdRef.current
      // The capture interval keeps ticking; frames no-op while this flag is set.
      analyzingRef.current = true
      setPhase('analyze')
      setInstruction('Confirming you are a live person…')

      try {
        const analyzer = analyzerRef.current
        if (!analyzer?.isReady) throw new Error('Face analyzer is not ready yet.')

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

        // One last dedicated read of the submitted frame, added to the session samples.
        const analysis = await analyzer.analyze(base64, width, height, 'gender')
        if (runIdRef.current !== runId) return 'done'
        const finalIssues = analysis.quality ? assessFaceQuality(analysis.quality) : []
        if (analysis.gender && !blocksGenderSample(finalIssues)) {
          pushGenderSample(analysis.gender)
        }

        const verdict = summarizeGenderSamples(genderSamplesRef.current, {
          minSamples: GENDER_VERIFICATION.minGenderSamples,
          threshold: GENDER_VERIFICATION.minGenderConfidence,
          borderlineBand: GENDER_VERIFICATION.genderBorderlineBand,
          minFacePixels: GENDER_VERIFICATION.minGenderFacePixels,
        })
        const qualityIssues = reportedFaceQualityIssues(qualityTallyRef.current)
        const age = medianAge(genderSamplesRef.current)
        const maxFacePixels = Math.max(
          0,
          ...genderSamplesRef.current.map((sample) => sample.facePixels ?? 0),
        )
        setDiagnostics({
          femaleScore: verdict.femaleScore,
          samples: verdict.samples,
          blinks: detectedBlinks,
          maxFacePixels,
          age,
          issues: qualityIssues,
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

        // A weak read in bad light / with glasses gets tips and another go, not a final "no".
        if (
          verdict.status === 'fail' &&
          qualityRetriesRef.current < FACE_QUALITY.maxQualityRetries &&
          shouldRetryForQuality(verdict.femaleScore, qualityIssues)
        ) {
          qualityRetriesRef.current += 1
          throw createGenderVerificationError(GENDER_ERROR_CODES.LOW_CONFIDENCE_RETRY)
        }

        const submittedLivenessScore = Math.max(livenessScore, avgLive)
        const {
          result,
          error: submitError,
          sessionId: submittedSessionId,
        } = await submitGenderVerificationSession({
          sessionId: activeSessionId,
          detectedBlinks,
          livenessScore: submittedLivenessScore,
          genderDetected: verdict.status === 'pass',
          genderConfidence: verdict.femaleScore,
          handoffToken: handoffTokenRef.current,
          clientMetrics: {
            platform: 'native',
            femaleScore: verdict.femaleScore,
            femaleRatio: verdict.femaleRatio,
            samples: verdict.samples,
            avgLive: Number(avgLive.toFixed(3)),
            avgReal: Number(avgReal.toFixed(3)),
            maxFacePixels,
            age,
            qualityIssues,
          },
        })
        sessionIdRef.current = submittedSessionId
        if (runIdRef.current !== runId) return 'done'

        if (submitError) throw new Error(submitError)
        if (verdict.status === 'fail') {
          throw createGenderVerificationError(GENDER_ERROR_CODES.NOT_ELIGIBLE)
        }
        if (!result?.ok) throw new Error(result?.message ?? 'Verification failed.')

        stopCaptureLoop()
        setPhase('success')
        setInstruction('Verified successfully')
        onVerified?.()
        return 'done'
      } catch (submitFailure) {
        if (runIdRef.current !== runId) return 'done'
        const message =
          submitFailure instanceof Error ? submitFailure.message : 'Verification failed.'
        stopCaptureLoop()
        setError(message)
        setPhase('error')
        setInstruction(getGenderErrorInstruction(submitFailure))
        return 'done'
      } finally {
        analyzingRef.current = false
        processingRef.current = false
      }
    },
    [onVerified, pushGenderSample, stopCaptureLoop],
  )

  const processFrame = useCallback(async () => {
    if (!loopActiveRef.current || processingRef.current || analyzingRef.current) return
    const camera = cameraRef.current
    const analyzer = analyzerRef.current
    if (!camera || !analyzer?.isReady) return

    const runId = runIdRef.current
    processingRef.current = true
    try {
      const picture = await camera.takePictureAsync({
        base64: true,
        quality: 0.4,
        shutterSound: false,
      })
      if (!picture.base64 || !loopActiveRef.current) return
      if (runIdRef.current !== runId) return

      const width = picture.width ?? 0
      const height = picture.height ?? 0
      frameSeqRef.current += 1
      // Sample gender periodically — 'both' keeps anti-spoof scores on the same pass.
      const wantGender =
        samplingModeRef.current === 'gender' ||
        frameSeqRef.current % GENDER_VERIFICATION.nativeGenderSampleEvery === 1
      const analysis = await analyzer.analyze(
        picture.base64,
        width,
        height,
        wantGender ? 'both' : 'liveness',
      )
      if (runIdRef.current !== runId || !loopActiveRef.current) return
      const face = analysis.face
      const leftEar = face?.leftEar ?? 0.3
      const rightEar = face?.rightEar ?? 0.3
      const avgEar = (leftEar + rightEar) / 2
      const frameWidth = analysis.width || width
      const frameHeight = analysis.height || height
      const centered = face ? isFaceCentered(face.box, frameWidth, frameHeight) : false

      const frameIssues = face && analysis.quality ? assessFaceQuality(analysis.quality) : []
      if (face) recordFaceQuality(qualityTallyRef.current, frameIssues)
      const qualityIssues = smoothFaceQuality(qualitySmootherRef.current, frameIssues)
      const qualityHint = faceQualityHint(qualityIssues)
      const otherFaceInView = qualityIssues.includes('multiple_faces')

      const blink = centered && !otherFaceInView
        ? stepBlinkLiveness(blinkTrackerRef.current, earCalibratorRef.current, leftEar, rightEar, {
            calibrationSamples: GENDER_VERIFICATION.nativeEarCalibrationSamples,
            fallbackBlink: GENDER_VERIFICATION.earBlinkThreshold,
            fallbackOpen: GENDER_VERIFICATION.earOpenThreshold,
            minClosedMs: GENDER_VERIFICATION.minClosedMs,
            maxClosedMs: GENDER_VERIFICATION.nativeMaxClosedMs,
            minBlinkGapMs: GENDER_VERIFICATION.minBlinkGapMs,
          })
        : null
      const eyesClosed = blink?.eyesClosed ?? false

      setTracking({
        faceDetected: !!face,
        faceCentered: centered,
        eyesClosed,
        calibrated: blink?.calibrated ?? earCalibratorRef.current.baseline != null,
        avgEar,
        liveScore: analysis.liveScore,
        realScore: analysis.realScore,
        qualityHint,
      })

      if (!face) {
        stableFramesRef.current = 0
        setInstruction('Position your face in the circle')
        setPhase('position')
        return
      }

      if (!centered) {
        stableFramesRef.current = 0
        setPhase('position')
        setInstruction('Move closer and center your face')
        return
      }

      if (otherFaceInView) {
        stableFramesRef.current = 0
        setPhase('position')
        setInstruction(qualityHint ?? 'Only one face should be in view')
        return
      }

      // Closed-eye, dark, or turned frames read as noise and drag real women under the bar.
      if (analysis.gender && !eyesClosed && !blocksGenderSample(frameIssues)) {
        pushGenderSample(analysis.gender)
      }
      if (analysis.liveScore > 0) {
        liveSamplesRef.current = [...liveSamplesRef.current.slice(-24), analysis.liveScore]
      }
      if (analysis.realScore > 0) {
        realSamplesRef.current = [...realSamplesRef.current.slice(-24), analysis.realScore]
      }
      stableFramesRef.current += 1
      setPhase('blink')

      const tracker = blinkTrackerRef.current
      setBlinkCount(tracker.count)

      const remaining = Math.max(0, GENDER_VERIFICATION.requiredBlinks - tracker.count)
      if (remaining > 0) {
        if (blink?.calibrated && blinkPromptAtRef.current == null) blinkPromptAtRef.current = Date.now()
        // A very quick blink can still fall between photos; only then ask for a slower one.
        const waitedLong =
          blinkPromptAtRef.current != null &&
          Date.now() - blinkPromptAtRef.current > GENDER_VERIFICATION.blinkSlowerHintMs
        setInstruction(
          !blink?.calibrated
            ? 'Hold still — look at the camera'
            : waitedLong
              ? 'Blink a little slower'
              : remaining === 1
                ? 'Now blink once'
                : `Now blink — ${remaining} left`,
        )
        return
      }

      if (!readyToJudgeGender()) {
        setInstruction('Almost there — hold still and look at the camera')
        return
      }

      const livenessScore = computeLivenessScore({
        detectedBlinks: tracker.count,
        requiredBlinks: GENDER_VERIFICATION.requiredBlinks,
        faceCentered: true,
        stableFrames: stableFramesRef.current,
        minStableFrames: 4,
      })

      await analyzeAndSubmit(tracker.count, livenessScore, picture.base64, frameWidth, frameHeight)
    } catch {
      if (runIdRef.current !== runId) return
      setError('Face tracking interrupted. Please try again.')
      setPhase('error')
      setInstruction(GENDER_ERROR_INSTRUCTIONS[GENDER_ERROR_CODES.LIVENESS_FAILED])
      stopCaptureLoop()
    } finally {
      processingRef.current = false
    }
  }, [analyzeAndSubmit, pushGenderSample, readyToJudgeGender, stopCaptureLoop])

  const startCaptureLoop = useCallback(() => {
    if (loopActiveRef.current) return
    loopActiveRef.current = true
    setInstruction('Center your face in the circle')
    intervalRef.current = setInterval(() => {
      void processFrame()
    }, GENDER_VERIFICATION.nativeFrameIntervalMs)
    void processFrame()
  }, [processFrame])

  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const softRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const softRetryUsedRef = useRef(false)
  const [softRetrying, setSoftRetrying] = useState(false)

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }, [])

  const clearSoftRetryTimer = useCallback(() => {
    if (softRetryTimerRef.current) {
      clearTimeout(softRetryTimerRef.current)
      softRetryTimerRef.current = null
    }
  }, [])

  const scheduleCaptureLoop = useCallback(
    (settleMs: number = GENDER_VERIFICATION.nativeCameraSettleMs) => {
      clearSettleTimer()
      // AVCapturePhotoOutput needs a moment after Allow / session start — early
      // takePicture used to SIGABRT the app (maxPhotoDimensions still 0).
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null
        if (!sessionIdRef.current || !cameraReadyRef.current) return
        if (analyzingRef.current) return
        startCaptureLoop()
      }, settleMs)
    },
    [clearSettleTimer, startCaptureLoop],
  )

  /** Mount the camera preview once session + models are ready (no photos yet). */
  const armCameraPreview = useCallback(() => {
    if (!sessionIdRef.current || !analyzerReady) return
    if (!cameraGranted && !cameraPermission?.granted) return
    if (loopActiveRef.current || analyzingRef.current) return
    if (phase === 'success' || phase === 'error' || phase === 'idle') return
    if (
      phase === 'camera' ||
      phase === 'position' ||
      phase === 'blink' ||
      phase === 'analyze'
    ) {
      return
    }
    setPhase('camera')
    setInstruction('Starting camera…')
  }, [analyzerReady, cameraGranted, cameraPermission?.granted, phase])

  const onCameraReady = useCallback(() => {
    cameraReadyRef.current = true
    if (!sessionIdRef.current) return
    setInstruction('Preparing camera…')
    scheduleCaptureLoop(GENDER_VERIFICATION.nativeCameraSettleMs)
  }, [scheduleCaptureLoop])

  const onAnalyzerReady = useCallback(() => {
    setAnalyzerReady(true)
  }, [])

  const onAnalyzerError = useCallback(
    (message: string) => {
      stopCaptureLoop()
      setAnalyzerReady(false)
      setError(message)
      setInstruction(GENDER_ERROR_INSTRUCTIONS[GENDER_ERROR_CODES.MODEL_LOAD_FAILED])
      setPhase('error')
    },
    [stopCaptureLoop],
  )

  useEffect(() => {
    armCameraPreview()
  }, [armCameraPreview])

  useEffect(
    () => () => {
      clearSettleTimer()
      clearSoftRetryTimer()
    },
    [clearSettleTimer, clearSoftRetryTimer],
  )

  const start = useCallback(async () => {
    // Two overlapping starts each create a session, and creating one supersedes
    // the other — the losing run then submits a good read to a dead session.
    if (startingRef.current) return
    startingRef.current = true
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    setError(null)
    setDiagnostics(null)
    setSoftRetrying(false)
    clearSoftRetryTimer()
    setPhase('loading')
    setInstruction('Checking camera permission…')
    blinkTrackerRef.current = createBlinkTracker()
    earCalibratorRef.current = createEarCalibrator()
    stableFramesRef.current = 0
    blinkPromptAtRef.current = null
    liveSamplesRef.current = []
    realSamplesRef.current = []
    genderSamplesRef.current = []
    qualitySmootherRef.current = createFaceQualitySmoother(
      FACE_QUALITY.nativeWindow,
      FACE_QUALITY.nativeMinHits,
    )
    qualityTallyRef.current = createFaceQualityTally()
    frameSeqRef.current = 0
    samplingModeRef.current = 'blink'
    extraRoundUsedRef.current = false
    extraRoundDeadlineRef.current = 0
    setBlinkCount(0)
    analyzingRef.current = false
    processingRef.current = false
    clearSettleTimer()
    stopCaptureLoop()

    // Keep a warm camera across retries — remounting is what left users staring
    // at a black "Preparing camera…" frame while the button said Restarting.
    const cameraAlreadyReady = cameraReadyRef.current

    try {
      // Ask for camera first (user gesture) — iOS only shows the sheet once while
      // status is undetermined. A previous Deny means canAskAgain=false and no sheet.
      const permission = await ensureCameraPermission()
      if (runIdRef.current !== runId) return
      if (!permission.granted) {
        const blocked = permission.canAskAgain === false
        const message = blocked
          ? 'Camera access is blocked. Open Settings → SHEconomy → Camera, turn it on, then try again.'
          : 'Camera permission is required for liveness verification. Please allow camera access when prompted.'
        setError(message)
        setInstruction(getGenderErrorInstruction(createGenderVerificationError(GENDER_ERROR_CODES.CAMERA_DENIED)))
        setPhase('error')
        return
      }

      setInstruction('Loading secure face models…')

      const { sessionId: createdSessionId, error: sessionError } =
        await createGenderVerificationSession(
          GENDER_VERIFICATION.requiredBlinks,
          handoffTokenRef.current,
        )
      if (runIdRef.current !== runId) return
      if (sessionError || !createdSessionId) {
        setError(sessionError ?? 'Could not start verification session.')
        setInstruction(GENDER_ERROR_INSTRUCTIONS[GENDER_ERROR_CODES.SESSION_FAILED])
        setPhase('error')
        return
      }
      sessionIdRef.current = createdSessionId

      if (!analyzerReady) {
        setInstruction('Loading secure face models…')
        return
      }

      setPhase('camera')
      if (cameraReadyRef.current) {
        // Camera stayed mounted (or finished warming during session create).
        setInstruction('Center your face in the circle')
        scheduleCaptureLoop(
          cameraAlreadyReady
            ? GENDER_VERIFICATION.nativeCameraResettleMs
            : GENDER_VERIFICATION.nativeCameraSettleMs,
        )
        return
      }

      setInstruction('Starting camera…')
    } finally {
      startingRef.current = false
    }
  }, [
    analyzerReady,
    clearSettleTimer,
    clearSoftRetryTimer,
    ensureCameraPermission,
    scheduleCaptureLoop,
    stopCaptureLoop,
  ])

  // Soft auto-retry once for lighting / face / liveness failures — never for
  // eligibility, or the women-first rejection loops forever on Restarting….
  useEffect(() => {
    if (phase !== 'error' || !error) return
    if (softRetryUsedRef.current || !isSoftRetryableGenderError(error)) return
    // A silent restart would hide the capture tips; let the user fix the setup first.
    if (diagnostics?.issues?.length) return
    softRetryUsedRef.current = true
    setSoftRetrying(true)
    setInstruction('Trying again with a clearer read…')
    softRetryTimerRef.current = setTimeout(() => {
      softRetryTimerRef.current = null
      void start()
    }, GENDER_VERIFICATION.softRetryDelayMs)
    return clearSoftRetryTimer
  }, [clearSoftRetryTimer, diagnostics, error, phase, start])

  const reset = useCallback(() => {
    clearSettleTimer()
    clearSoftRetryTimer()
    stopCaptureLoop()
    runIdRef.current += 1
    startingRef.current = false
    sessionIdRef.current = null
    cameraReadyRef.current = false
    softRetryUsedRef.current = false
    setSoftRetrying(false)
    setBlinkCount(0)
    setDiagnostics(null)
    setError(null)
    setPhase('idle')
    setInstruction('Start when you are ready')
    qualityRetriesRef.current = 0
    blinkTrackerRef.current = createBlinkTracker()
    earCalibratorRef.current = createEarCalibrator()
    stableFramesRef.current = 0
    blinkPromptAtRef.current = null
    liveSamplesRef.current = []
    realSamplesRef.current = []
    genderSamplesRef.current = []
    qualitySmootherRef.current = createFaceQualitySmoother(
      FACE_QUALITY.nativeWindow,
      FACE_QUALITY.nativeMinHits,
    )
    qualityTallyRef.current = createFaceQualityTally()
    frameSeqRef.current = 0
    samplingModeRef.current = 'blink'
    extraRoundUsedRef.current = false
    extraRoundDeadlineRef.current = 0
    analyzingRef.current = false
    processingRef.current = false
    setTracking({
      faceDetected: false,
      faceCentered: false,
      eyesClosed: false,
      calibrated: false,
      avgEar: null,
      liveScore: 0,
      realScore: 0,
    })
  }, [clearSettleTimer, clearSoftRetryTimer, stopCaptureLoop])

  const cameraBlocked =
    !cameraGranted &&
    cameraPermission?.granted === false &&
    cameraPermission?.canAskAgain === false

  return {
    supported: true,
    phase,
    error,
    instruction,
    blinkCount,
    requiredBlinks: GENDER_VERIFICATION.requiredBlinks,
    tracking,
    softRetrying,
    diagnostics,
    containerRef,
    cameraRef,
    analyzerRef,
    cameraPermission: cameraGranted
      ? { ...(cameraPermission ?? { status: 'granted' as const, canAskAgain: true }), granted: true }
      : cameraPermission,
    cameraBlocked,
    requestCameraPermission,
    openCameraSettings,
    onCameraReady,
    onAnalyzerReady,
    onAnalyzerError,
    start,
    reset,
  }
}
