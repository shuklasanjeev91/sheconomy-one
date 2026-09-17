import type { ReactNode } from 'react'
import { Modal, Platform, Pressable, View } from 'react-native'

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
import {
  toFriendlyGenderError,
  formatVerificationDiagnostics,
  HUMAN_VERIFICATION_DISCLAIMER,
  GENDER_ERROR_CODES,
  classifyGenderError,
  type VerificationDiagnostics,
} from '~/lib/gender-verification'
import { useAppUi } from '~/lib/theme/useAppUi'

type GenderVerificationModalProps = {
  open: boolean
  /**
   * When false, hide the header close control. Skip remains available so camera
   * / face data collection is always optional (App Store 5.1.1).
   */
  dismissible?: boolean
  /** Dismiss / skip verification (continue with limited access). */
  onClose: () => void
  /** Fired once the member is verified — the host refreshes the profile here. */
  onVerified: () => void
}

/**
 * App-wide "Human Verification" popup. Reuses the shared liveness hook and panel
 * (3-blink MediaPipe check + on-device gender estimate) but presents it as a
 * dismissible modal instead of a full page.
 */
export function GenderVerificationModal({
  open,
  dismissible = true,
  onClose,
  onVerified,
}: GenderVerificationModalProps) {
  const shell = (
    <GenderVerificationModalShell
      dismissible={dismissible}
      onClose={onClose}
      onVerified={onVerified}
    />
  )

  // Native: RN Modal escapes SafeArea / overflow:hidden shell clipping.
  if (Platform.OS !== 'web') {
    return (
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        {open ? shell : null}
      </Modal>
    )
  }

  if (!open) return null
  return shell
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
      pointerEvents="box-none"
    >
      <YStack
        width="100%"
        maxWidth={isDesktop ? 520 : undefined}
        flex={isDesktop ? undefined : 1}
        maxHeight={isDesktop ? ('90vh' as const) : ('100%' as const)}
        minHeight={isDesktop ? undefined : 0}
        backgroundColor={ui.surface}
        borderRadius={isDesktop ? radius.card : 0}
        borderWidth={isDesktop ? 1 : 0}
        borderColor={ui.borderSubtle}
        overflow="hidden"
        paddingTop={isDesktop ? 0 : safeTop}
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
              : { flex: 1, minHeight: 0 }
        }
      >
        <ModalHeader ui={ui} dismissible={dismissible} onClose={onClose} />
        <VerificationFlow
          onClose={onClose}
          onVerified={onVerified}
          footerPad={isDesktop ? 20 : Math.max(safeBottom, 12)}
          fillHeight={!isDesktop}
        />
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
      paddingVertical="$3"
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      backgroundColor={ui.background}
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
            Optional · on-device · real person
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

/**
 * @param fillHeight Stretch to a definite-height parent (mobile sheet). Desktop
 * centers a content-sized dialog, where `flex: 1` (basis 0) would collapse the
 * body to zero height and leave only the header visible.
 */
function VerificationFlow({
  onClose,
  onVerified,
  footerPad,
  fillHeight,
}: {
  onClose: () => void
  onVerified: () => void
  footerPad: number
  fillHeight: boolean
}) {
  const ui = useAppUi()
  const verification = useGenderVerification({ onVerified })

  const isRunning =
    verification.phase !== 'idle' &&
    verification.phase !== 'error' &&
    verification.phase !== 'success'

  const softRetrying = 'softRetrying' in verification && verification.softRetrying
  const friendlyError = verification.error ? toFriendlyGenderError(verification.error) : null
  const diagnostics = (verification as { diagnostics?: VerificationDiagnostics | null }).diagnostics
  const diagnosticsLine = diagnostics ? formatVerificationDiagnostics(diagnostics) : null
  const errorCode = verification.error ? classifyGenderError(verification.error) : null
  const errorTitle =
    errorCode === GENDER_ERROR_CODES.NOT_ELIGIBLE
      ? 'Access not unlocked'
      : softRetrying
        ? 'Retrying…'
        : 'Let’s try that again'
  const cameraBlocked = 'cameraBlocked' in verification && verification.cameraBlocked

  const primaryLabel =
    softRetrying || (isRunning && verification.phase === 'loading')
      ? 'Starting…'
      : verification.phase === 'idle'
        ? 'Start verification'
        : verification.phase === 'error'
          ? 'Try again'
          : 'Verification in progress…'

  if (verification.phase === 'success') {
    return (
      <GenderVerificationErrorBoundary scope="Modal" onReset={verification.reset}>
        <YStack
          flexGrow={fillHeight ? 1 : 0}
          minHeight={fillHeight ? 0 : 240}
          alignItems="center"
          justifyContent="center"
          gap="$3"
          padding="$5"
        >
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
            Full access to the {BRAND_NAME} community, chat, and seller tools is now unlocked.
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
      <YStack
        flexGrow={fillHeight ? 1 : 0}
        flexShrink={1}
        flexBasis={fillHeight ? 0 : 'auto'}
        minHeight={0}
        width="100%"
      >
        <ScrollView
          flexGrow={fillHeight ? 1 : 0}
          flexShrink={1}
          flexBasis={fillHeight ? 0 : 'auto'}
          zIndex={0}
          width="100%"
          minHeight={0}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 12,
            gap: 16,
            flexGrow: 1,
          }}
        >
          {verification.phase === 'idle' ? (
            <YStack gap="$3">
              <Text fontSize={14} color={ui.textSecondary} lineHeight={21}>
                Optional face check — blink {verification.requiredBlinks} times to unlock Community,
                Chat, and Create store. Video stays on this device. Skip anytime to keep using
                Commerce, Classes, and Co-Work.
              </Text>
              <YStack
                padding="$3"
                borderRadius={radius.chip}
                backgroundColor={ui.surfaceMuted}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                gap="$1.5"
              >
                <Text fontSize={13} fontWeight="700" color={ui.text}>
                  Our commitment
                </Text>
                <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
                  {HUMAN_VERIFICATION_DISCLAIMER}
                </Text>
              </YStack>
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
                Use a device with a front camera and allow camera access to complete verification.
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
            onAnalyzerReady={
              'onAnalyzerReady' in verification ? verification.onAnalyzerReady : undefined
            }
            onAnalyzerError={
              (verification as { onAnalyzerError?: (message: string) => void }).onAnalyzerError
            }
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
                  {errorTitle}
                </Text>
              </XStack>
              <Text color={ui.textSecondary} fontSize={13} lineHeight={19}>
                {friendlyError}
              </Text>
              {diagnosticsLine ? (
                <Text color={ui.textMuted} fontSize={11} lineHeight={16}>
                  {diagnosticsLine}
                </Text>
              ) : null}
            </YStack>
          ) : null}
        </ScrollView>

        {/* Sticky actions — RN View + elevation so Android touches hit buttons,
            not a sibling WebView surface from the face analyzer. */}
        <View
          collapsable={false}
          pointerEvents="box-none"
          style={{
            width: '100%',
            zIndex: 40,
            elevation: 40,
            backgroundColor: ui.surface,
            borderTopWidth: 1,
            borderTopColor: ui.borderSubtle,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: footerPad,
            gap: 10,
          }}
        >
          {cameraBlocked ? (
            <ActionButton
              primary
              label="Open Settings"
              onPress={() => {
                if ('openCameraSettings' in verification) verification.openCameraSettings()
              }}
              brand={ui.brand}
              onBrand={ui.onBrand}
              text={ui.text}
              border={ui.borderSubtle}
            />
          ) : (
            <ActionButton
              primary
              label={primaryLabel}
              disabled={isRunning || softRetrying || !verification.supported}
              onPress={() => {
                void verification.start()
              }}
              icon={
                verification.phase === 'idle' ? (
                  <Icons.Camera size={18} color={ui.onBrand} />
                ) : undefined
              }
              brand={ui.brand}
              onBrand={ui.onBrand}
              text={ui.text}
              border={ui.borderSubtle}
            />
          )}

          {verification.phase === 'error' && !cameraBlocked && !softRetrying ? (
            <ActionButton
              label="Reset"
              onPress={verification.reset}
              brand={ui.brand}
              onBrand={ui.onBrand}
              text={ui.text}
              border={ui.borderSubtle}
            />
          ) : null}

          <ActionButton
            label="Skip for now"
            onPress={onClose}
            accessibilityLabel="Skip human verification"
            brand={ui.brand}
            onBrand={ui.onBrand}
            text={ui.text}
            border={ui.borderSubtle}
          />
          <Text fontSize={12} color={ui.textMuted} textAlign="center" lineHeight={17}>
            Skip keeps Commerce, Classes, and Co-Work unlocked.
          </Text>
        </View>
      </YStack>
    </GenderVerificationErrorBoundary>
  )
}

/**
 * RN Pressable footer actions — Tamagui Button presses can be swallowed on
 * Android when a sibling WebView (face analyzer) owns a native surface.
 */
function ActionButton({
  label,
  onPress,
  primary = false,
  disabled = false,
  icon,
  accessibilityLabel,
  brand,
  onBrand,
  text,
  border,
}: {
  label: string
  onPress: () => void
  primary?: boolean
  disabled?: boolean
  icon?: ReactNode
  accessibilityLabel?: string
  brand: string
  onBrand: string
  text: string
  border: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 14,
        opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
        backgroundColor: primary ? brand : 'transparent',
        borderWidth: primary ? 0 : 1.5,
        borderColor: border,
        transform: pressed && !disabled ? [{ scale: 0.98 }] : undefined,
      })}
    >
      {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
      <Text fontSize={15} fontWeight="700" color={primary ? onBrand : text}>
        {label}
      </Text>
    </Pressable>
  )
}
