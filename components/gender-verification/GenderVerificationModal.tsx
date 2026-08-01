import { Platform } from 'react-native'

import {
  FaceCaptureOverlay,
  VerificationSteps,
} from '~/components/gender-verification/GenderVerificationPanel'
import { GenderVerificationErrorBoundary } from '~/components/gender-verification/GenderVerificationErrorBoundary'
import { Button, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { BRAND_NAME } from '~/config/brand'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useGenderVerification } from '~/hooks/useGenderVerification'
import { toFriendlyGenderError } from '~/lib/gender-verification'
import { useAppUi } from '~/lib/theme/useAppUi'

type GenderVerificationModalProps = {
  open: boolean
  /** When false, hide close / "Maybe later" (required verification on protected routes). */
  dismissible?: boolean
  /** Dismiss the modal (postpone verification). */
  onClose: () => void
  /** Fired once the member is verified — the host refreshes the profile here. */
  onVerified: () => void
}

/**
 * App-wide "Human Verification" popup. Reuses the shared liveness hook and panel
 * (3-blink MediaPipe check + on-device gender estimate) but presents it as a
 * dismissible modal instead of a full page. The flow is wrapped in
 * `GenderVerificationErrorBoundary` so any failure — including a 413
 * image-too-large — is shown with a friendly, actionable message.
 */
export function GenderVerificationModal({
  open,
  dismissible = true,
  onClose,
  onVerified,
}: GenderVerificationModalProps) {
  if (!open) return null

  // Mounted only while open so the camera stream is released on close (the
  // liveness hook stops all tracks on unmount).
  return (
    <GenderVerificationModalShell
      dismissible={dismissible}
      onClose={onClose}
      onVerified={onVerified}
    />
  )
}

function GenderVerificationModalShell({
  dismissible = true,
  onClose,
  onVerified,
}: Omit<GenderVerificationModalProps, 'open'>) {
  const ui = useAppUi()
  const { isDesktop, safeTop, safeBottom } = useAppLayout()

  return (
    <YStack
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={200_020}
      backgroundColor="rgba(0,0,0,0.55)"
      alignItems="center"
      justifyContent={isDesktop ? 'center' : 'flex-end'}
      padding={isDesktop ? '$4' : 0}
      // Keep backdrop from eating header presses; children manage their own hits.
      pointerEvents="box-none"
    >
      <YStack
        width="100%"
        maxWidth={isDesktop ? 560 : undefined}
        flex={isDesktop ? undefined : 1}
        maxHeight={isDesktop ? ('90vh' as const) : ('100%' as const)}
        minHeight={isDesktop ? undefined : 0}
        backgroundColor={ui.surface}
        borderRadius={isDesktop ? radius.card : 0}
        borderWidth={isDesktop ? 1 : 0}
        borderColor={ui.borderSubtle}
        overflow="hidden"
        // Full-bleed on phones: clear notch / home indicator without using `top`
        // offsets (those shift the header over the ScrollView and steal presses).
        paddingTop={isDesktop ? 0 : safeTop}
        paddingBottom={isDesktop ? 0 : Math.max(safeBottom, 8)}
        pointerEvents="auto"
        style={
          Platform.OS === 'web'
            ? ({
                ...(isDesktop ? getShadowStyle('lg') : {}),
                display: 'flex',
                flexDirection: 'column',
                ...(isDesktop ? {} : { flex: 1, minHeight: 0 }),
              } as const)
            : isDesktop
              ? getShadowStyle('lg')
              : undefined
        }
      >
        <ModalHeader ui={ui} dismissible={dismissible} onClose={onClose} />
        <ScrollView
          width="100%"
          flex={isDesktop ? undefined : 1}
          minHeight={isDesktop ? undefined : 0}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          style={
            Platform.OS === 'web'
              ? ({
                  overflowY: 'auto',
                  ...(isDesktop
                    ? { maxHeight: 'calc(90vh - 72px)' }
                    : { flex: 1, minHeight: 0 }),
                } as const)
              : isDesktop
                ? undefined
                : ({ flex: 1 } as const)
          }
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 28,
            gap: 20,
          }}
        >
          <VerificationFlow dismissible={dismissible} onClose={onClose} onVerified={onVerified} />
        </ScrollView>
      </YStack>
    </YStack>
  )
}

function ModalHeader({
  ui,
  dismissible,
  onClose,
}: {
  ui: ReturnType<typeof useAppUi>
  dismissible: boolean
  onClose: () => void
}) {
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$4"
      paddingVertical="$3.5"
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      backgroundColor={ui.background}
      // Sit above the body ScrollView so the close control always receives taps
      // on iOS / Android (sibling scroll views can otherwise steal hits).
      zIndex={2}
      position="relative"
    >
      <XStack alignItems="center" gap="$3" flex={1} minWidth={0} pointerEvents="none">
        <YStack
          width={40}
          height={40}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor={ui.roseSurface}
        >
          <Icons.Shield size={20} color={ui.brand} />
        </YStack>
        <YStack flex={1} minWidth={0}>
          <Text fontSize={16} fontWeight="800" color={ui.text}>
            Human verification
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            Secure, women-first identity check
          </Text>
        </YStack>
      </XStack>
      {dismissible ? (
        <XStack
          width={44}
          height={44}
          alignItems="center"
          justifyContent="center"
          borderRadius={999}
          cursor="pointer"
          aria-label="Close verification"
          accessibilityRole="button"
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          hoverStyle={{ backgroundColor: ui.surfaceHover }}
          pressStyle={{ opacity: 0.75, scale: 0.96 }}
          onPress={onClose}
        >
          <Icons.X size={22} color={ui.textSecondary} />
        </XStack>
      ) : null}
    </XStack>
  )
}

function VerificationFlow({
  dismissible,
  onClose,
  onVerified,
}: {
  dismissible: boolean
  onClose: () => void
  onVerified: () => void
}) {
  const ui = useAppUi()

  const verification = useGenderVerification({ onVerified })

  const isRunning =
    verification.phase !== 'idle' &&
    verification.phase !== 'error' &&
    verification.phase !== 'success'

  const friendlyError = verification.error ? toFriendlyGenderError(verification.error) : null

  if (verification.phase === 'success') {
    return (
      <GenderVerificationErrorBoundary scope="Modal" onReset={verification.reset}>
      <YStack alignItems="center" gap="$3" paddingVertical="$4">
        <YStack
          width={64}
          height={64}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor="rgba(22, 163, 74, 0.12)"
        >
          <Icons.ShieldCheck size={32} color="#16a34a" />
        </YStack>
        <Text fontSize={18} fontWeight="800" color={ui.text} textAlign="center">
          You’re verified!
        </Text>
        <Text fontSize={14} color={ui.textMuted} textAlign="center" maxWidth={360} lineHeight={20}>
          Full access to the {BRAND_NAME} community and seller tools is now unlocked.
        </Text>
        <Button tone="primary" size="$4" borderRadius={radius.pill} width="100%" onPress={onClose}>
          Continue
        </Button>
      </YStack>
      </GenderVerificationErrorBoundary>
    )
  }

  return (
    <GenderVerificationErrorBoundary scope="Modal" onReset={verification.reset}>
    <YStack gap="$4">
      {verification.phase === 'idle' ? (
        <YStack gap="$2">
          <Text fontSize={15} color={ui.textSecondary} lineHeight={22}>
            Keep {BRAND_NAME} women-first with a live face check. Center your face and blink
            naturally {verification.requiredBlinks} times — photos and screen replays are rejected.
            Video stays on your device.
          </Text>
        </YStack>
      ) : null}

      {!verification.supported ? (
        <YStack
          padding="$3"
          borderRadius={radius.chip}
          backgroundColor="rgba(180, 83, 9, 0.08)"
          borderWidth={1}
          borderColor="rgba(180, 83, 9, 0.2)"
          gap="$1.5"
        >
          <XStack alignItems="center" gap="$2">
            <Icons.AlertTriangle size={16} color="#b45309" />
            <Text fontSize={13} fontWeight="700" color="#b45309">
              Camera required
            </Text>
          </XStack>
          <Text color={ui.textSecondary} fontSize={13} lineHeight={19}>
            Use a device with a front camera and allow browser camera access to complete verification.
          </Text>
        </YStack>
      ) : null}

      <VerificationSteps phase={verification.phase} />

      <FaceCaptureOverlay
        containerRef={verification.containerRef}
        phase={verification.phase}
        instruction={verification.instruction}
        blinkCount={verification.blinkCount}
        requiredBlinks={verification.requiredBlinks}
        tracking={verification.tracking}
        cameraRef={'cameraRef' in verification ? verification.cameraRef : undefined}
        analyzerRef={'analyzerRef' in verification ? verification.analyzerRef : undefined}
        cameraPermission={
          'cameraPermission' in verification ? verification.cameraPermission : undefined
        }
        onCameraReady={'onCameraReady' in verification ? verification.onCameraReady : undefined}
        onAnalyzerReady={'onAnalyzerReady' in verification ? verification.onAnalyzerReady : undefined}
      />

      {friendlyError ? (
        <YStack
          padding="$3"
          borderRadius={radius.chip}
          backgroundColor="rgba(180, 83, 9, 0.08)"
          borderWidth={1}
          borderColor="rgba(180, 83, 9, 0.2)"
          gap="$1.5"
        >
          <XStack alignItems="center" gap="$2">
            <Icons.AlertTriangle size={16} color="#b45309" />
            <Text fontSize={13} fontWeight="700" color="#b45309">
              Let’s try that again
            </Text>
          </XStack>
          <Text color={ui.textSecondary} fontSize={13} lineHeight={19}>
            {friendlyError}
          </Text>
        </YStack>
      ) : null}

      <YStack gap="$2.5">
        <Button
          tone="primary"
          size="$4"
          borderRadius={radius.pill}
          disabled={isRunning || !verification.supported}
          onPress={() => {
            void verification.start()
          }}
          icon={verification.phase === 'idle' ? <Icons.Camera size={18} color={ui.onBrand} /> : undefined}
        >
          {verification.phase === 'idle'
            ? 'Start verification'
            : verification.phase === 'error'
              ? 'Restarting…'
              : 'Verification in progress…'}
        </Button>

        {verification.phase === 'error' ? (
          <Button tone="outline" size="$4" borderRadius={radius.pill} onPress={verification.reset}>
            Try again
          </Button>
        ) : null}

        {dismissible ? (
          <Button chromeless size="$3" onPress={onClose}>
            <Text color={ui.textMuted} fontSize={14}>
              Maybe later
            </Text>
          </Button>
        ) : null}
      </YStack>
    </YStack>
    </GenderVerificationErrorBoundary>
  )
}
