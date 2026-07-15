import { Text, XStack, YStack } from '~/components/ui'
import { AppLink } from '~/components/navigation/AppLink'
import { useAppUi } from '~/lib/theme/useAppUi'
import { appRoutes } from '~/lib/routes'

type AuthConsentProps = {
  accepted: boolean
  onChange: (accepted: boolean) => void
  error?: string | null
}

/** Explicit Terms + Privacy consent before OTP / social continue. */
export function AuthConsent({ accepted, onChange, error }: AuthConsentProps) {
  const ui = useAppUi()

  return (
    <YStack gap="$2">
      <XStack
        alignItems="flex-start"
        gap="$3"
        cursor="pointer"
        onPress={() => onChange(!accepted)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
      >
        <YStack
          width={22}
          height={22}
          borderRadius={6}
          borderWidth={1.5}
          borderColor={error ? ui.error : accepted ? ui.brand : ui.border}
          backgroundColor={accepted ? ui.brand : 'transparent'}
          alignItems="center"
          justifyContent="center"
          marginTop={2}
        >
          {accepted ? (
            <Text color={ui.onBrand} fontSize={12} fontWeight="800">
              ✓
            </Text>
          ) : null}
        </YStack>
        <Text fontSize={13} color={ui.textMuted} lineHeight={19} flex={1}>
          I agree to the{' '}
          <AppLink href={appRoutes.legalTerms} asChild>
            <Text color={ui.brand} fontWeight="700">
              Terms of Service
            </Text>
          </AppLink>{' '}
          and{' '}
          <AppLink href={appRoutes.legalPrivacy} asChild>
            <Text color={ui.brand} fontWeight="700">
              Privacy Policy
            </Text>
          </AppLink>
          . SHEconomy will send a one-time verification code.
        </Text>
      </XStack>
      {error ? (
        <Text fontSize={12} color={ui.error} fontWeight="600">
          {error}
        </Text>
      ) : null}
    </YStack>
  )
}
