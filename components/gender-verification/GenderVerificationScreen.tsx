import { useRouter } from 'one'
import { Platform } from 'react-native'
import { useEffect } from 'react'

import { AuthBackButton } from '~/components/auth/AuthBackButton'
import {
  FaceCaptureOverlay,
  VerificationSteps,
} from '~/components/gender-verification/GenderVerificationPanel'
import { ScreenFill, FormRail } from '~/components/layout'
import { Button, Icons, Text, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAccess } from '~/hooks/useAccess'
import { useGenderVerification } from '~/hooks/useGenderVerification'
import { refreshProfiles } from '~/lib/profile/refresh'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

export function GenderVerificationScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const { isFemale } = useAccess()

  const verification = useGenderVerification({
    onVerified: () => {
      refreshProfiles()
      setTimeout(() => {
        router.replace(communityRoutes.home)
      }, 1200)
    },
  })

  useEffect(() => {
    if (Platform.OS === 'web' || !isFemale) return
    refreshProfiles()
    router.replace(communityRoutes.home)
  }, [isFemale, router])

  const isRunning =
    verification.phase !== 'idle' &&
    verification.phase !== 'error' &&
    verification.phase !== 'success'

  const nativeWebViewMode = Platform.OS !== 'web'

  return (
    <ScreenFill
      backgroundColor={ui.background}
      paddingHorizontal="$4"
      paddingVertical="$6"
      alignItems="center"
      gap="$6"
    >
      <FormRail gap="$5">
        <AuthBackButton variant="dark" />

        <YStack gap="$2">
          <Text fontSize={28} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
            Face liveness verification
          </Text>
          <Text fontSize={15} color={ui.textMuted} lineHeight={22}>
            Aadhaar-style check: position your face, blink naturally, and we&apos;ll verify liveness
            to unlock the full {BRAND_NAME} experience for women.
          </Text>
        </YStack>

        <YStack
          padding="$4.5"
          borderRadius={radius.card}
          backgroundColor={ui.surface}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          gap="$5"
          style={getShadowStyle('sm')}
        >
          {!nativeWebViewMode ? <VerificationSteps phase={verification.phase} /> : null}
          <FaceCaptureOverlay
            containerRef={verification.containerRef}
            phase={nativeWebViewMode ? 'camera' : verification.phase}
            instruction={verification.instruction}
            blinkCount={verification.blinkCount}
            requiredBlinks={verification.requiredBlinks}
          />

          {verification.error && !nativeWebViewMode ? (
            <YStack
              padding="$3"
              borderRadius={radius.chip}
              backgroundColor="rgba(185, 28, 28, 0.08)"
              borderWidth={1}
              borderColor="rgba(185, 28, 28, 0.18)"
            >
              <Text color={ui.error} fontSize={14} lineHeight={20}>
                {verification.error}
              </Text>
            </YStack>
          ) : null}

          {verification.phase === 'success' ? (
            <YStack
              padding="$4"
              borderRadius={radius.card}
              backgroundColor="rgba(22, 163, 74, 0.1)"
              borderWidth={1}
              borderColor="rgba(22, 163, 74, 0.2)"
              alignItems="center"
              gap="$2"
            >
              <Icons.ShieldCheck size={28} color="#16a34a" />
              <Text fontWeight="700" color={ui.text} textAlign="center">
                You&apos;re verified. Redirecting to Community…
              </Text>
            </YStack>
          ) : nativeWebViewMode ? null : (
            <YStack gap="$3">
              <Button
                tone="primary"
                size="$4"
                borderRadius={radius.pill}
                disabled={isRunning || !verification.supported}
                onPress={() => {
                  void verification.start()
                }}
              >
                {verification.phase === 'idle' ? 'Start verification' : 'Verification in progress…'}
              </Button>
              {verification.phase === 'error' ? (
                <Button tone="outline" size="$4" borderRadius={radius.pill} onPress={verification.reset}>
                  Try again
                </Button>
              ) : null}
            </YStack>
          )}
        </YStack>

        <YStack gap="$2">
          <Text fontSize={13} fontWeight="700" color={ui.textSecondary}>
            Privacy & security
          </Text>
          <Text fontSize={13} color={ui.textMuted} lineHeight={20}>
            Video stays on your device during liveness checks. Only verification scores are sent to{' '}
            {BRAND_NAME} — not stored video recordings.
          </Text>
        </YStack>
      </FormRail>
    </ScreenFill>
  )
}
