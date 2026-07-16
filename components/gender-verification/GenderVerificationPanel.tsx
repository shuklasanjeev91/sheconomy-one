import type { RefObject } from 'react'
import { Platform, StyleSheet } from 'react-native'
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
}

function ringColor(phase: VerificationPhase, tracking?: FaceTrackingStatus, brand?: string) {
  if (phase === 'success') return '#16a34a'
  if (phase === 'analyze') return brand ?? '#e11d48'
  if (tracking?.eyesClosed) return '#0ea5e9'
  if (tracking?.faceCentered) return '#22c55e'
  if (tracking?.faceDetected) return '#f59e0b'
  return 'rgba(255,255,255,0.7)'
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
}: FaceCaptureOverlayProps) {
  const ui = useAppUi()
  const showCamera =
    phase === 'loading' ||
    phase === 'camera' ||
    phase === 'position' ||
    phase === 'blink' ||
    phase === 'analyze'
  const ring = ringColor(phase, tracking, ui.brand)
  const progress = Math.min(1, blinkCount / Math.max(1, requiredBlinks))

  const body = (
    <YStack width="100%" alignItems="center" gap="$4">
      <YStack
        width="100%"
        maxWidth={380}
        aspectRatio={1}
        borderRadius={999}
        overflow="hidden"
        backgroundColor="#111"
        borderWidth={3}
        borderColor={ring}
        position="relative"
      >
        {Platform.OS !== 'web' ? (
          showCamera && cameraPermission?.granted ? (
            <ExpoCameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
              mirror
              onCameraReady={onCameraReady}
            />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center" gap="$3" padding="$4">
              {phase === 'loading' ? <Spinner size="large" color="white" /> : <Icons.ScanFace size={36} color="rgba(255,255,255,0.85)" />}
              <Text fontSize={14} color="rgba(255,255,255,0.75)" textAlign="center">
                {cameraPermission?.granted === false
                  ? 'Allow camera access to continue'
                  : phase === 'idle'
                    ? 'Camera ready when you start'
                    : 'Preparing camera…'}
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
                opacity: showCamera ? 1 : 0,
              }}
            />
            {!showCamera ? (
              <YStack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                alignItems="center"
                justifyContent="center"
                gap="$3"
                padding="$4"
              >
                <Icons.ScanFace size={36} color="rgba(255,255,255,0.85)" />
                <Text fontSize={14} color="rgba(255,255,255,0.75)" textAlign="center">
                  Camera ready when you start
                </Text>
              </YStack>
            ) : null}
          </>
        )}

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
          >
            <Spinner size="large" color="white" />
            <Text fontSize={13} color="white" fontWeight="600">
              {phase === 'loading' ? 'Loading models…' : 'Checking liveness…'}
            </Text>
          </YStack>
        ) : null}
      </YStack>

      <YStack width="100%" maxWidth={380} gap="$3" alignItems="center">
        <Text fontSize={18} fontWeight="700" color={ui.text} textAlign="center" lineHeight={24}>
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
            <XStack justifyContent="center" gap="$3" marginTop="$1">
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
      <YStack width="100%" alignItems="center">
        <NativeFaceAnalyzer ref={analyzerRef} onReady={onAnalyzerReady} />
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
    if (phase === 'idle' || phase === 'error') return 'todo'
    if (phase === 'loading') return id === 'position' ? 'active' : 'todo'
    if (id === 'position') return phase === 'position' || phase === 'camera' ? 'active' : 'done'
    if (id === 'blink') return phase === 'blink' ? 'active' : phase === 'analyze' ? 'done' : 'todo'
    return phase === 'analyze' ? 'active' : 'todo'
  }

  return (
    <XStack width="100%" alignItems="center" justifyContent="center" gap="$2">
      {steps.map((step, index) => {
        const state = stateOf(step.id)
        const color =
          state === 'done' || state === 'active' ? ui.brand : ui.textMuted
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
                  <Text fontSize={11} fontWeight="800" color={state === 'active' ? ui.onBrand : ui.textMuted}>
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

