import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking } from 'react-native'
import type { CameraView } from 'expo-camera'
import { Camera, useCameraPermissions } from 'expo-camera'

import type { NativeFaceAnalyzerHandle } from '~/components/gender-verification/NativeFaceAnalyzer'
import {
  GENDER_VERIFICATION,
  type FaceTrackingStatus,
  type VerificationPhase,
  completeGenderVerificationSession,
  computeLivenessScore,
  createBlinkTracker,
  createEarCalibrator,
  createGenderVerificationSession,
  isFaceCentered,
  passesAntiSpoof,
  thresholdsFromBaseline,
  updateBlinkTracker,
  updateEarCalibrator,
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
  const [analyzerReady, setAnalyzerReady] = useState(false)
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
  const liveSamplesRef = useRef<number[]>([])
  const realSamplesRef = useRef<number[]>([])
  const lastGenderRef = useRef<{ isFemale: boolean; confidence: number } | null>(null)
  const analyzingRef = useRef(false)
  const processingRef = useRef(false)
  const loopActiveRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionIdRef = useRef<string | null>(null)
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
    async (detectedBlinks: number, livenessScore: number, base64: string, width: number, height: number) => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || analyzingRef.current) return
      analyzingRef.current = true
      stopCaptureLoop()
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

        const analysis = await analyzer.analyze(base64, width, height, 'gender')
        const gender = analysis.gender ?? lastGenderRef.current
        if (!gender) throw new Error('Could not analyze your face. Try again in good lighting.')
        if (!gender.isFemale || gender.confidence < GENDER_VERIFICATION.minGenderConfidence) {
          throw new Error(
            `${BRAND_NAME} could not confirm Human verification with the required confidence.`,
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

        setPhase('success')
        setInstruction('Verified successfully')
        onVerified?.()
      } catch (submitFailure) {
        const message =
          submitFailure instanceof Error ? submitFailure.message : 'Verification failed.'
        setError(message)
        setPhase('error')
        setInstruction(message)
      } finally {
        analyzingRef.current = false
        processingRef.current = false
      }
    },
    [onVerified, stopCaptureLoop],
  )

  const processFrame = useCallback(async () => {
    if (!loopActiveRef.current || processingRef.current || analyzingRef.current) return
    const camera = cameraRef.current
    const analyzer = analyzerRef.current
    if (!camera || !analyzer?.isReady) return

    processingRef.current = true
    try {
      const picture = await camera.takePictureAsync({
        base64: true,
        quality: 0.35,
        shutterSound: false,
      })
      if (!picture.base64 || !loopActiveRef.current) return

      const width = picture.width ?? 0
      const height = picture.height ?? 0
      const analysis = await analyzer.analyze(picture.base64, width, height, 'liveness')
      const face = analysis.face
      const leftEar = face?.leftEar ?? 0.3
      const rightEar = face?.rightEar ?? 0.3
      const avgEar = (leftEar + rightEar) / 2

      updateEarCalibrator(earCalibratorRef.current, avgEar, 8)
      const thresholds = thresholdsFromBaseline(
        earCalibratorRef.current.baseline,
        GENDER_VERIFICATION.earBlinkThreshold,
        GENDER_VERIFICATION.earOpenThreshold,
      )
      const eyesClosed = avgEar < thresholds.blinkThreshold

      setTracking({
        faceDetected: !!face,
        faceCentered: face
          ? isFaceCentered(face.box, analysis.width || width, analysis.height || height)
          : false,
        eyesClosed,
        calibrated: thresholds.calibrated,
        avgEar,
        liveScore: analysis.liveScore,
        realScore: analysis.realScore,
      })

      if (!face) {
        stableFramesRef.current = 0
        setInstruction('Position your face in the circle')
        setPhase('position')
        return
      }

      const frameWidth = analysis.width || width
      const frameHeight = analysis.height || height
      const centered = isFaceCentered(face.box, frameWidth, frameHeight)
      if (!centered) {
        stableFramesRef.current = 0
        setPhase('position')
        setInstruction('Move closer and center your face')
        return
      }

      if (analysis.gender) lastGenderRef.current = analysis.gender
      if (analysis.liveScore > 0) {
        liveSamplesRef.current = [...liveSamplesRef.current.slice(-24), analysis.liveScore]
      }
      if (analysis.realScore > 0) {
        realSamplesRef.current = [...realSamplesRef.current.slice(-24), analysis.realScore]
      }
      stableFramesRef.current += 1
      setPhase('blink')

      const tracker = updateBlinkTracker(blinkTrackerRef.current, leftEar, rightEar, {
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
      setError('Face tracking interrupted. Please try again.')
      setPhase('error')
      stopCaptureLoop()
    } finally {
      processingRef.current = false
    }
  }, [analyzeAndSubmit, stopCaptureLoop])

  const startCaptureLoop = useCallback(() => {
    if (loopActiveRef.current) return
    loopActiveRef.current = true
    setInstruction('Center your face, then blink naturally')
    intervalRef.current = setInterval(() => {
      void processFrame()
    }, GENDER_VERIFICATION.nativeFrameIntervalMs)
    void processFrame()
  }, [processFrame])

  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
  }, [])

  const scheduleCaptureLoop = useCallback(() => {
    clearSettleTimer()
    // AVCapturePhotoOutput needs a moment after Allow / session start — early
    // takePicture used to SIGABRT the app (maxPhotoDimensions still 0).
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null
      if (!sessionIdRef.current || !cameraReadyRef.current) return
      if (analyzingRef.current) return
      startCaptureLoop()
    }, GENDER_VERIFICATION.nativeCameraSettleMs)
  }, [clearSettleTimer, startCaptureLoop])

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
    setInstruction('Preparing camera…')
    scheduleCaptureLoop()
  }, [scheduleCaptureLoop])

  const onAnalyzerReady = useCallback(() => {
    setAnalyzerReady(true)
  }, [])

  useEffect(() => {
    armCameraPreview()
  }, [armCameraPreview])

  useEffect(
    () => () => {
      clearSettleTimer()
    },
    [clearSettleTimer],
  )

  const start = useCallback(async () => {
    setError(null)
    setPhase('loading')
    setInstruction('Checking camera permission…')
    blinkTrackerRef.current = createBlinkTracker()
    earCalibratorRef.current = createEarCalibrator()
    stableFramesRef.current = 0
    liveSamplesRef.current = []
    realSamplesRef.current = []
    lastGenderRef.current = null
    setBlinkCount(0)
    analyzingRef.current = false
    processingRef.current = false
    cameraReadyRef.current = false
    clearSettleTimer()
    stopCaptureLoop()

    // Ask for camera first (user gesture) — iOS only shows the sheet once while
    // status is undetermined. A previous Deny means canAskAgain=false and no sheet.
    const permission = await ensureCameraPermission()
    if (!permission.granted) {
      const blocked = permission.canAskAgain === false
      const message = blocked
        ? 'Camera access is blocked. Open Settings → SHEconomy → Camera, turn it on, then try again.'
        : 'Camera permission is required for liveness verification. Please allow camera access when prompted.'
      setError(message)
      setInstruction(message)
      setPhase('error')
      return
    }

    setInstruction('Loading secure face models…')

    const { sessionId: createdSessionId, error: sessionError } =
      await createGenderVerificationSession()
    if (sessionError || !createdSessionId) {
      setError(sessionError ?? 'Could not start verification session.')
      setInstruction(sessionError ?? 'Could not start verification session.')
      setPhase('error')
      return
    }
    sessionIdRef.current = createdSessionId

    if (!analyzerReady) {
      setInstruction('Loading secure face models…')
      return
    }
    // Mount preview; takePicture waits for onCameraReady + settle delay.
    setPhase('camera')
    setInstruction('Starting camera…')
  }, [analyzerReady, clearSettleTimer, ensureCameraPermission, stopCaptureLoop])

  const reset = useCallback(() => {
    clearSettleTimer()
    stopCaptureLoop()
    sessionIdRef.current = null
    cameraReadyRef.current = false
    setBlinkCount(0)
    setError(null)
    setPhase('idle')
    setInstruction('Start when you are ready')
    blinkTrackerRef.current = createBlinkTracker()
    earCalibratorRef.current = createEarCalibrator()
    stableFramesRef.current = 0
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
  }, [clearSettleTimer, stopCaptureLoop])

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
    start,
    reset,
  }
}
