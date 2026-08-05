import { useEffect, useState, type ComponentType } from 'react'
import { Platform, StyleSheet } from 'react-native'

import { Button, Spinner, YStack } from '~/components/ui'
import { useIsDarkTheme } from '~/lib/theme/useAppUi'

type AppleSignInButtonProps = {
  disabled?: boolean
  busy?: boolean
  onPress: () => void
}

type AppleAuthModule = typeof import('expo-apple-authentication')

/**
 * iOS: system ASAuthorizationAppleIDButton when the native module loads.
 * Falls back to a branded outline button if the module is unavailable
 * (avoids a hard crash from static import / vxrn interop issues).
 */
export function AppleSignInButton({ disabled, busy, onPress }: AppleSignInButtonProps) {
  const isDark = useIsDarkTheme()
  const [apple, setApple] = useState<AppleAuthModule | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    let cancelled = false
    void import('expo-apple-authentication')
      .then((mod) => {
        if (!cancelled) setApple(mod)
      })
      .catch(() => {
        // Keep fallback button — native Sign in with Apple still runs via oauth.ts.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (Platform.OS !== 'ios' || !apple?.AppleAuthenticationButton) {
    return (
      <Button
        tone="outline"
        size="$4"
        borderRadius={999}
        disabled={disabled || busy}
        onPress={onPress}
        icon={busy ? <Spinner size="small" /> : undefined}
        backgroundColor={isDark ? '$color1' : '$color12'}
        borderColor={isDark ? '$color1' : '$color12'}
        color={isDark ? '$color12' : '$color1'}
      >
        {busy ? 'Connecting…' : 'Sign in with Apple'}
      </Button>
    )
  }

  const AppleAuthenticationButton = apple.AppleAuthenticationButton as ComponentType<{
    buttonType: unknown
    buttonStyle: unknown
    cornerRadius: number
    style: object
    onPress: () => void
  }>

  return (
    <YStack
      width="100%"
      height={48}
      opacity={disabled || busy ? 0.55 : 1}
      pointerEvents={disabled || busy ? 'none' : 'auto'}
    >
      <AppleAuthenticationButton
        buttonType={apple.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={
          isDark
            ? apple.AppleAuthenticationButtonStyle.WHITE
            : apple.AppleAuthenticationButtonStyle.BLACK
        }
        cornerRadius={999}
        style={styles.appleButton}
        onPress={onPress}
      />
    </YStack>
  )
}

const styles = StyleSheet.create({
  appleButton: {
    width: '100%',
    height: 48,
  },
})
