import { useEffect, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { AuthOnboarding } from '~/components/auth/AuthOnboarding'
import { BrandSplashFallback } from '~/components/brand/BrandSplashFallback'
import {
  hasSeenAppOnboarding,
  markAppOnboardingSeen,
} from '~/lib/onboarding/first-launch'

type NativeAppOnboardingGateProps = {
  children: ReactNode
}

/**
 * iOS / Android only — shows the professional first-launch carousel once,
 * then unlocks the main app shell. Web is a no-op (auth shell still owns
 * compact-web onboarding before sign-in).
 */
export function NativeAppOnboardingGate({ children }: NativeAppOnboardingGateProps) {
  const [ready, setReady] = useState(Platform.OS === 'web')
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'web') return

    let cancelled = false
    void hasSeenAppOnboarding()
      .then((seen) => {
        if (cancelled) return
        setShowIntro(!seen)
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setShowIntro(true)
        setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (Platform.OS === 'web') {
    return <>{children}</>
  }

  if (!ready) {
    return <BrandSplashFallback />
  }

  if (showIntro) {
    return (
      <AuthOnboarding
        variant="app"
        onFinish={() => {
          setShowIntro(false)
          void markAppOnboardingSeen()
        }}
      />
    )
  }

  return <>{children}</>
}
