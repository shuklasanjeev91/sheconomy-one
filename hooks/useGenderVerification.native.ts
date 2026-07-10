import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraView } from 'expo-camera'
import { useCameraPermissions } from 'expo-camera'

import type { NativeFaceAnalyzerHandle } from '~/components/gender-verification/NativeFaceAnalyzer'
import {
  GENDER_VERIFICATION,
  type VerificationPhase,
  completeGenderVerificationSession,
  computeLivenessScore,
  createBlinkTracker,
  createGenderVerificationSession,
  isFaceCentered,
  updateBlinkTracker,
} from '~/lib/gender-verification'

import { BRAND_NAME } from '~/config/brand'

type UseGenderVerificationOptions = {
  onVerified?: () => void
}

const FRAME_INTERVAL_MS = 450

export function useGenderVerification({ onVerified }: UseGenderVerificationOptions = {}) {
  const [phase, setPhase] = useState<VerificationPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [blinkCount, setBlinkCount] = useState(0)
  const [instruction, setInstruction] = useState('Prepare for face verification')
  const [analyzerReady, setAnalyzerReady] = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  const cameraRef = useRef<CameraView | null>(null)
  const analyzerRef = useRef<NativeFaceAnalyzerHandle | null>(null)
  const blinkTrackerRef = useRef(createBlinkTracker())
  const stableFramesRef = useRef(0)
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

  const analyzeAndSubmit = useCallback(
    async (detectedBlinks: number, livenessScore: number, base64: string, width: number, height: number) => {
      const activeSessionId = sessionIdRef.current
      if (!activeSessionId || analyzingRef.current) return
      analyzingRef.current = true
      stopCaptureLoop()
      setPhase('analyze')
      setInstruction('Analyzing your verification…')

      try {
        const analyzer = analyzerRef.current
        if (!analyzer?.isReady) {
          throw new Error('Face analyzer is not ready. Please wait a moment and try again.')
        }

        const analysis = await analyzer.analyze(base64, width, height, 'gender')
        const gender = analysis.gender
        if (!gender) {
          throw new Error('Could not analyze your face. Please try again in good lighting.')
        }

        if (!gender.isFemale || gender.confidence < GENDER_VERIFICATION.minGenderConfidence) {
          throw new Error(
            `${BRAND_NAME} community access is available to women. Verification did not meet the required confidence.`,
          )
        }

        const { result, error: submitError } = await completeGenderVerificationSession({
          sessionId: activeSessionId,
          detectedBlinks,
          livenessScore,
          genderDetected: gender.isFemale,
          genderConfidence: gender.confidence,
        })

        if (submitError) throw new Error(submitError)
        if (!result?.ok) throw new Error(result?.message ?? 'Verification failed.')

        setPhase('success')
        setInstruction('Verification successful!')
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
        skipProcessing: true,
        shutterSound: false,
      })

      if (!picture.base64 || !loopActiveRef.current) return

      const width = picture.width ?? 0
      const height = picture.height ?? 0
      const analysis = await analyzer.analyze(picture.base64, width, height, 'liveness')
      const face = analysis.face

      if (!face) {
        stableFramesRef.current = 0
        setInstruction('Center your face inside the oval')
        setPhase('position')
        return
      }

      const frameWidth = analysis.width || width
      const frameHeight = analysis.height || height
      const centered = isFaceCentered(face.box, frameWidth, frameHeight)

      if (!centered) {
        stableFramesRef.current = 0
        setPhase('position')
        setInstruction('Move closer and align your face in the oval')
        return
      }

      stableFramesRef.current += 1
      setPhase('blink')

      const tracker = updateBlinkTracker(
        blinkTrackerRef.current,
        face.leftEar,
        face.rightEar,
        GENDER_VERIFICATION.earBlinkThreshold,
        GENDER_VERIFICATION.earOpenThreshold,
      )
      blinkTrackerRef.current = tracker
      setBlinkCount(tracker.count)

      const remaining = Math.max(0, GENDER_VERIFICATION.requiredBlinks - tracker.count)
      if (remaining > 0) {
        setInstruction(`Blink naturally ${remaining} more time${remaining === 1 ? '' : 's'}`)
        return
      }

      const livenessScore = computeLivenessScore({
        detectedBlinks: tracker.count,
        requiredBlinks: GENDER_VERIFICATION.requiredBlinks,
        faceCentered: centered,
        stableFrames: stableFramesRef.current,
        minStableFrames: 8,
      })

      if (livenessScore < GENDER_VERIFICATION.minLivenessScore) {
        setInstruction('Hold still for a moment, then blink again')
        blinkTrackerRef.current = createBlinkTracker()
        setBlinkCount(0)
        stableFramesRef.current = 0
        return
      }

      await analyzeAndSubmit(tracker.count, livenessScore, picture.base64, frameWidth, frameHeight)
    } catch {
      setError('Face tracking was interrupted. Please try again.')
      setPhase('error')
      stopCaptureLoop()
    } finally {
      processingRef.current = false
    }
  }, [analyzeAndSubmit, stopCaptureLoop])

  const startCaptureLoop = useCallback(() => {
    if (loopActiveRef.current) return
    loopActiveRef.current = true
    intervalRef.current = setInterval(() => {
      void processFrame()
    }, FRAME_INTERVAL_MS)
    void processFrame()
  }, [processFrame])

  const tryStartVerification = useCallback(() => {
    if (!sessionIdRef.current || !analyzerReady || !cameraReadyRef.current) return
    if (!cameraPermission?.granted) return
    if (loopActiveRef.current || analyzingRef.current) return
    if (phase === 'success' || phase === 'error') return

    setPhase('camera')
    setInstruction('Center your face inside the oval')
    startCaptureLoop()
  }, [analyzerReady, cameraPermission?.granted, phase, startCaptureLoop])

  const onCameraReady = useCallback(() => {
    cameraReadyRef.current = true
    tryStartVerification()
  }, [tryStartVerification])

  const onAnalyzerReady = useCallback(() => {
    setAnalyzerReady(true)
  }, [])

  useEffect(() => {
    tryStartVerification()
  }, [tryStartVerification])

  const start = useCallback(async () => {
    setError(null)
    setPhase('loading')
    setInstruction('Starting secure verification…')
    blinkTrackerRef.current = createBlinkTracker()
    stableFramesRef.current = 0
    setBlinkCount(0)
    analyzingRef.current = false
    processingRef.current = false
    cameraReadyRef.current = false
    stopCaptureLoop()

    const { sessionId: createdSessionId, error: sessionError } =
      await createGenderVerificationSession()

    if (sessionError || !createdSessionId) {
      setError(sessionError ?? 'Could not start verification session.')
      setPhase('error')
      return
    }

    setSessionId(createdSessionId)
    sessionIdRef.current = createdSessionId

    let permission = cameraPermission
    if (!permission?.granted) {
      permission = await requestCameraPermission()
    }

    if (!permission?.granted) {
      setError('Camera permission is required for liveness verification.')
      setPhase('error')
      return
    }

    if (!analyzerReady) {
      setInstruction('Loading face verification models…')
      return
    }

    tryStartVerification()
  }, [
    analyzerReady,
    cameraPermission,
    requestCameraPermission,
    stopCaptureLoop,
    tryStartVerification,
  ])

  const reset = useCallback(() => {
    stopCaptureLoop()
    sessionIdRef.current = null
    cameraReadyRef.current = false
    setSessionId(null)
    setBlinkCount(0)
    setError(null)
    setPhase('idle')
    setInstruction('Prepare for face verification')
    blinkTrackerRef.current = createBlinkTracker()
    stableFramesRef.current = 0
    analyzingRef.current = false
    processingRef.current = false
  }, [stopCaptureLoop])

  return {
    supported: true,
    phase,
    error,
    instruction,
    blinkCount,
    requiredBlinks: GENDER_VERIFICATION.requiredBlinks,
    containerRef,
    cameraRef,
    analyzerRef,
    cameraPermission,
    requestCameraPermission,
    onCameraReady,
    onAnalyzerReady,
    start,
    reset,
  }
}
