import { useRouter } from 'one'
import { Platform } from 'react-native'
import { useEffect } from 'react'

import { AuthBackButton } from '~/components/auth/AuthBackButton'
import {
  FaceCaptureOverlay,
  VerificationSteps,
} from '~/components/gender-verification/GenderVerificationPanel'
import { ScreenFill } from '~/components/layout'
import { Button, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { BRAND_NAME } from '~/config/brand'
import { useAccess } from '~/hooks/useAccess'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useGenderVerification } from '~/hooks/useGenderVerification'
import { useProfile } from '~/hooks/useProfile'
import { refreshProfiles } from '~/lib/profile/refresh'
import { patchCachedProfile } from '~/lib/profile/profile-cache'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function GenderVerificationScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const { isFemale } = useAccess()
  const { profile } = useProfile()
  const { gutter, safeTop, safeBottom } = useAppLayout()

  const verification = useGenderVerification({
    onVerified: () => {
      if (profile?.id) {
        void patchCachedProfile(profile.id, { is_verified: true }).then(() => refreshProfiles())
      } else {
        refreshProfiles()
      }
      setTimeout(() => {
        router.push(communityRoutes.home)
      }, 1100)
    },
  })

  useEffect(() => {
    if (Platform.OS === 'web' || !isFemale) return
    refreshProfiles()
    router.push(communityRoutes.home)
  }, [isFemale, router])

  const isRunning =
    verification.phase !== 'idle' &&
    verification.phase !== 'error' &&
    verification.phase !== 'success'

  return (
    <ScreenFill backgroundColor={ui.background} flex={1} minHeight={0} width="100%">
      <ScrollView
        flex={1}
        width="100%"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: gutter,
          paddingTop: Math.max(safeTop, 12) + 8,
          paddingBottom: Math.max(safeBottom, 24) + 20,
        }}
      >
        <YStack width="100%" maxWidth={560} alignSelf="center" gap="$5">
          <XStack alignItems="center" justifyContent="space-between">
            <AuthBackButton variant="dark" />
            <Text fontSize={12} fontWeight="700" color={ui.textMuted}>
              Private · On your device
            </Text>
          </XStack>

          <YStack gap="$2" alignItems="center">
            <Text fontSize={13} fontWeight="700" color={ui.brand} letterSpacing={1}>
              VERIFICATION
            </Text>
            <Text
              fontSize={30}
              fontWeight="800"
              color={ui.text}
              textAlign="center"
              letterSpacing={-0.6}
              lineHeight={36}
            >
              Confirm it&apos;s you
            </Text>
            <Text fontSize={15} color={ui.textMuted} textAlign="center" lineHeight={22} maxWidth={420}>
              Center your face and blink naturally {verification.requiredBlinks} times. This quick
              check helps keep {BRAND_NAME} safe — your video stays on this device.
            </Text>
          </YStack>

          <YStack
            width="100%"
            padding="$5"
            borderRadius={28}
            backgroundColor={ui.surface}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            gap="$5"
            alignItems="center"
            style={getShadowStyle('sm')}
          >
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
            />

            {verification.error ? (
              <YStack
                width="100%"
                padding="$3.5"
                borderRadius={16}
                backgroundColor="rgba(185,28,28,0.08)"
                borderWidth={1}
                borderColor="rgba(185,28,28,0.18)"
                gap="$1.5"
              >
                <Text fontSize={13} fontWeight="700" color={ui.error}>
                  Couldn&apos;t verify
                </Text>
                <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
                  {verification.error}
                </Text>
              </YStack>
            ) : null}

            {verification.phase === 'success' ? (
              <YStack alignItems="center" gap="$2" paddingVertical="$2">
                <Icons.ShieldCheck size={32} color="#16a34a" />
                <Text fontSize={16} fontWeight="800" color={ui.text}>
                  You&apos;re verified
                </Text>
                <Text fontSize={13} color={ui.textMuted}>
                  Taking you to {BRAND_NAME}…
                </Text>
              </YStack>
            ) : (
              <YStack width="100%" gap="$2.5">
                <Button
                  tone="primary"
                  size="$4"
                  borderRadius={radius.pill}
                  width="100%"
                  disabled={isRunning || !verification.supported}
                  onPress={() => {
                    void verification.start()
                  }}
                >
                  {verification.phase === 'idle'
                    ? 'Start verification'
                    : verification.phase === 'error'
                      ? 'Try again'
                      : 'Verifying…'}
                </Button>
                {verification.phase === 'error' ? (
                  <Button tone="outline" size="$4" borderRadius={radius.pill} onPress={verification.reset}>
                    Reset
                  </Button>
                ) : null}
              </YStack>
            )}
          </YStack>

          <Text fontSize={12} color={ui.textMuted} textAlign="center" lineHeight={18}>
            Processed on your device. We save only a verification result — never your video.
          </Text>
        </YStack>
      </ScrollView>
    </ScreenFill>
  )
}
