import type { RefObject } from 'react'
import { Platform, StyleSheet, useWindowDimensions } from 'react-native'
import type { CameraView } from 'expo-camera'
import { CameraView as ExpoCameraView } from 'expo-camera'
import type { PermissionResponse } from 'expo-modules-core'

import {
  NativeFaceAnalyzer,
  type NativeFaceAnalyzerHandle,
} from '~/components/gender-verification/NativeFaceAnalyzer'
import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import type { FaceTrackingStatus, VerificationPhase } from '~/lib/gender-verification'
import { useAppUi } from '~/lib/theme/useAppUi'

type FaceCaptureOverlayProps = {
  containerRef: RefObject<HTMLDivElement | null>
  phase: VerificationPhase
  instruction: string
  blinkCount: number
  requiredBlinks: number
  tracking?: FaceTrackingStatus
  cameraRef?: RefObject<CameraView | null>
  analyzerRef?: RefObject<NativeFaceAnalyzerHandle | null>
  cameraPermission?: PermissionResponse | null
  onCameraReady?: () => void
  onAnalyzerReady?: () => void
  onAnalyzerError?: (message: string) => void
}

function ringColor(phase: VerificationPhase, tracking?: FaceTrackingStatus, brand?: string) {
  if (phase === 'success') return '#16a34a'
  if (phase === 'error') return '#f59e0b'
  if (phase === 'analyze') return brand ?? '#e11d48'
  if (tracking?.eyesClosed) return '#0ea5e9'
  if (tracking?.faceCentered) return '#22c55e'
  if (tracking?.faceDetected) return '#f59e0b'
  return 'rgba(255,255,255,0.55)'
}

function placeholderCopy(
  phase: VerificationPhase,
  cameraPermission?: PermissionResponse | null,
): string {
  if (cameraPermission?.granted === false && cameraPermission?.canAskAgain === false) {
    return 'Camera is blocked. Enable it in Settings → SHEconomy → Camera.'
  }
  if (cameraPermission?.granted === false && cameraPermission?.status === 'denied') {
    return 'Allow camera access when prompted to continue.'
  }
  if (phase === 'idle') return 'Tap Start when you are ready'
  if (phase === 'loading') return 'Checking permission…'
  if (phase === 'error') return 'Ready when you are — tap Try again'
  if (phase === 'success') return 'You’re verified'
  return 'Preparing camera…'
}

export function FaceCaptureOverlay({
  containerRef,
  phase,
  instruction,
  blinkCount,
  requiredBlinks,
  tracking,
  cameraRef,
  analyzerRef,
  cameraPermission,
  onCameraReady,
  onAnalyzerReady,
  onAnalyzerError,
}: FaceCaptureOverlayProps) {
  const ui = useAppUi()
  const { width: windowWidth } = useWindowDimensions()
  // Keep the preview mounted through error so Try again doesn't remount the
  // camera and land on a black "Preparing camera…" frame.
  const showCamera =
    phase === 'camera' ||
    phase === 'position' ||
    phase === 'blink' ||
    phase === 'analyze' ||
    phase === 'error' ||
    phase === 'loading'
  const ring = ringColor(phase, tracking, ui.brand)
  const progress = Math.min(1, blinkCount / Math.max(1, requiredBlinks))

  // Portrait frame — avoids the oversized circle on iPad while staying face-friendly.
  const frameWidth = Math.min(320, Math.max(240, windowWidth - 64))
  const frameHeight = Math.round(frameWidth * 1.25)

  const body = (
    <YStack width="100%" alignItems="center" gap="$3.5">
      <YStack
        width={frameWidth}
        height={frameHeight}
        borderRadius={frameWidth / 2}
        overflow="hidden"
        backgroundColor="#0f0f10"
        borderWidth={3}
        borderColor={ring}
        position="relative"
        alignSelf="center"
        pointerEvents="none"
      >
        {Platform.OS !== 'web' ? (
          showCamera && cameraPermission?.granted ? (
            <ExpoCameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
              facing="front"
              mode="picture"
              mirror
              onCameraReady={onCameraReady}
            />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$5">
              {phase === 'loading' ? (
                <Spinner size="large" color="white" />
              ) : (
                <Icons.ScanFace size={40} color="rgba(255,255,255,0.9)" />
              )}
              <Text fontSize={14} color="rgba(255,255,255,0.78)" textAlign="center" lineHeight={20}>
                {placeholderCopy(phase, cameraPermission)}
              </Text>
            </YStack>
          )
        ) : (
          <>
            <div
              ref={containerRef}
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                opacity: showCamera && phase !== 'idle' ? 1 : 0,
              }}
            />
            {phase === 'idle' || (phase === 'error' && !showCamera) ? (
              <YStack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                alignItems="center"
                justifyContent="center"
                gap="$3"
                padding="$5"
              >
                <Icons.ScanFace size={40} color="rgba(255,255,255,0.9)" />
                <Text fontSize={14} color="rgba(255,255,255,0.78)" textAlign="center">
                  {placeholderCopy(phase, cameraPermission)}
                </Text>
              </YStack>
            ) : null}
          </>
        )}

        {/* Soft oval guide so users know where to place their face */}
        {showCamera && cameraPermission?.granted && phase !== 'error' && phase !== 'success' ? (
          <YStack
            position="absolute"
            top="12%"
            left="14%"
            right="14%"
            bottom="18%"
            borderRadius={999}
            borderWidth={1.5}
            borderColor="rgba(255,255,255,0.35)"
            pointerEvents="none"
          />
        ) : null}

        {phase === 'loading' || phase === 'analyze' ? (
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            justifyContent="center"
            backgroundColor="rgba(0,0,0,0.45)"
            gap="$2"
            pointerEvents="none"
          >
            <Spinner size="large" color="white" />
            <Text fontSize={13} color="white" fontWeight="600">
              {phase === 'loading' ? 'Getting ready…' : 'Checking liveness…'}
            </Text>
          </YStack>
        ) : null}

        {phase === 'error' ? (
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            justifyContent="center"
            backgroundColor="rgba(0,0,0,0.55)"
            gap="$2"
            padding="$5"
            pointerEvents="none"
          >
            <Icons.AlertTriangle size={28} color="#fbbf24" />
            <Text fontSize={13} color="white" fontWeight="700" textAlign="center">
              Let’s try again
            </Text>
          </YStack>
        ) : null}
      </YStack>

      <YStack width="100%" maxWidth={frameWidth + 40} gap="$2.5" alignItems="center">
        <Text fontSize={17} fontWeight="700" color={ui.text} textAlign="center" lineHeight={24}>
          {instruction}
        </Text>

        {(phase === 'camera' || phase === 'position' || phase === 'blink') && (
          <YStack width="100%" gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
                Liveness blinks
              </Text>
              <Text fontSize={12} fontWeight="800" color={ui.text}>
                {blinkCount}/{requiredBlinks}
              </Text>
            </XStack>
            <YStack
              width="100%"
              height={8}
              borderRadius={999}
              backgroundColor={ui.surfaceMuted}
              overflow="hidden"
            >
              <YStack
                width={`${Math.round(progress * 100)}%`}
                height="100%"
                backgroundColor={ui.brand}
                borderRadius={999}
              />
            </YStack>
            <XStack justifyContent="center" gap="$3.5" marginTop="$1">
              <Text fontSize={11} color={tracking?.faceDetected ? ui.brand : ui.textMuted}>
                {tracking?.faceDetected ? '● Face' : '○ Face'}
              </Text>
              <Text fontSize={11} color={tracking?.faceCentered ? ui.brand : ui.textMuted}>
                {tracking?.faceCentered ? '● Centered' : '○ Centered'}
              </Text>
              <Text fontSize={11} color={(tracking?.liveScore ?? 0) > 0.4 ? ui.brand : ui.textMuted}>
                {(tracking?.liveScore ?? 0) > 0.4 ? '● Live' : '○ Live'}
              </Text>
            </XStack>
          </YStack>
        )}
      </YStack>
    </YStack>
  )

  if (Platform.OS !== 'web') {
    return (
      <YStack width="100%" alignItems="center" position="relative">
        {/* Keep analyzer out of the scroll/hit stack — only the host clips touches. */}
        <NativeFaceAnalyzer ref={analyzerRef} onReady={onAnalyzerReady} onError={onAnalyzerError} />
        {body}
      </YStack>
    )
  }

  return body
}

type VerificationStepsProps = {
  phase: VerificationPhase
}

export function VerificationSteps({ phase }: VerificationStepsProps) {
  const ui = useAppUi()
  const steps = [
    { id: 'position', label: 'Align' },
    { id: 'blink', label: 'Blink' },
    { id: 'analyze', label: 'Verify' },
  ] as const

  function stateOf(id: (typeof steps)[number]['id']) {
    if (phase === 'success') return 'done'
    if (phase === 'idle') return 'todo'
    if (phase === 'error') {
      // Keep progress visible after a failed run so the user knows how far they got.
      if (id === 'position') return 'done'
      if (id === 'blink') return 'done'
      return 'active'
    }
    if (phase === 'loading') return id === 'position' ? 'active' : 'todo'
    if (id === 'position') return phase === 'position' || phase === 'camera' ? 'active' : 'done'
    if (id === 'blink') return phase === 'blink' ? 'active' : phase === 'analyze' ? 'done' : 'todo'
    return phase === 'analyze' ? 'active' : 'todo'
  }

  return (
    <XStack width="100%" alignItems="center" justifyContent="center" gap="$2">
      {steps.map((step, index) => {
        const state = stateOf(step.id)
        const color = state === 'done' || state === 'active' ? ui.brand : ui.textMuted
        return (
          <XStack key={step.id} alignItems="center" gap="$2">
            <XStack alignItems="center" gap={8}>
              <YStack
                width={22}
                height={22}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                backgroundColor={state === 'todo' ? ui.surfaceMuted : ui.brand}
              >
                {state === 'done' ? (
                  <Icons.Check size={12} color={ui.onBrand} />
                ) : (
                  <Text
                    fontSize={11}
                    fontWeight="800"
                    color={state === 'active' ? ui.onBrand : ui.textMuted}
                  >
                    {index + 1}
                  </Text>
                )}
              </YStack>
              <Text fontSize={13} fontWeight="700" color={color}>
                {step.label}
              </Text>
            </XStack>
            {index < steps.length - 1 ? (
              <YStack width={28} height={1} backgroundColor={ui.borderSubtle} />
            ) : null}
          </XStack>
        )
      })}
    </XStack>
  )
}
