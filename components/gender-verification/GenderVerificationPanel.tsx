import type { RefObject } from 'react'
import { Platform } from 'react-native'

import { useAuthUi } from '~/components/auth/auth-theme'
import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import type { VerificationPhase } from '~/lib/gender-verification'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

type FaceCaptureOverlayProps = {
  containerRef: RefObject<HTMLDivElement | null>
  phase: VerificationPhase
  instruction: string
  blinkCount: number
  requiredBlinks: number
}

export function FaceCaptureOverlay({
  containerRef,
  phase,
  instruction,
  blinkCount,
  requiredBlinks,
}: FaceCaptureOverlayProps) {
  const ui = useAppUi()
  const active = phase === 'camera' || phase === 'position' || phase === 'blink' || phase === 'analyze'

  if (Platform.OS !== 'web') {
    return (
      <YStack
        borderRadius={24}
        backgroundColor={ui.surfaceMuted}
        padding="$6"
        alignItems="center"
        gap="$3"
      >
        <Icons.ScanFace size={48} color={ui.brand} />
        <Text textAlign="center" color={ui.textMuted}>
          Open {BRAND_NAME} in a web browser to complete face liveness verification.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$4" width="100%" alignItems="center">
      <YStack
        width="100%"
        maxWidth={420}
        aspectRatio={3 / 4}
        borderRadius={24}
        overflow="hidden"
        backgroundColor="#101010"
        position="relative"
        borderWidth={1}
        borderColor={ui.borderSubtle}
      >
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
          }}
        />

        <div
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '62%',
              height: '72%',
              borderRadius: '50%',
              border: `3px solid ${active ? '#ffffff' : 'rgba(255,255,255,0.45)'}`,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.42)',
            }}
          />
        </div>

        {phase === 'analyze' ? (
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            justifyContent="center"
            backgroundColor="rgba(0,0,0,0.45)"
          >
            <Spinner size="large" color="white" />
          </YStack>
        ) : null}
      </YStack>

      <YStack gap="$2" width="100%" maxWidth={420} alignItems="center">
        <Text fontSize={18} fontWeight="800" color={ui.text} textAlign="center">
          {instruction}
        </Text>
        {phase === 'blink' || phase === 'camera' || phase === 'position' ? (
          <Text fontSize={14} color={ui.textMuted} textAlign="center">
            Blinks detected: {blinkCount}/{requiredBlinks}
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
}

type VerificationStepsProps = {
  phase: VerificationPhase
}

const STEPS = [
  { id: 'position', label: 'Position face' },
  { id: 'blink', label: 'Blink check' },
  { id: 'analyze', label: 'Verify' },
] as const

export function VerificationSteps({ phase }: VerificationStepsProps) {
  const authUi = useAuthUi()
  const ui = useAppUi()

  function stepState(stepId: (typeof STEPS)[number]['id']) {
    if (phase === 'success') return 'done'
    if (phase === 'error' || phase === 'idle' || phase === 'loading') return 'pending'
    if (stepId === 'position') {
      return phase === 'position' || phase === 'camera' ? 'active' : 'done'
    }
    if (stepId === 'blink') {
      if (phase === 'blink') return 'active'
      return phase === 'analyze' || phase === 'success' ? 'done' : 'pending'
    }
    return phase === 'analyze' ? 'active' : phase === 'success' ? 'done' : 'pending'
  }

  return (
    <XStack gap="$2" width="100%" maxWidth={420} justifyContent="space-between">
      {STEPS.map((step) => {
        const state = stepState(step.id)
        const color =
          state === 'done' ? ui.brand : state === 'active' ? ui.text : authUi.stepText
        const bg =
          state === 'done' ? ui.brand : state === 'active' ? ui.surfaceMuted : authUi.stepInactive

        return (
          <YStack key={step.id} flex={1} gap="$2" alignItems="center">
            <YStack
              width={30}
              height={30}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor={bg}
            >
              {state === 'done' ? (
                <Icons.Check size={16} color={ui.onBrand} />
              ) : (
                <Text fontSize={12} fontWeight="800" color={state === 'active' ? ui.text : authUi.stepText}>
                  {step.id === 'position' ? '1' : step.id === 'blink' ? '2' : '3'}
                </Text>
              )}
            </YStack>
            <Text fontSize={11} fontWeight="600" color={color} textAlign="center">
              {step.label}
            </Text>
          </YStack>
        )
      })}
    </XStack>
  )
}