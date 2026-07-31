import { useEffect, useState, type ReactNode } from 'react'
import { InteractionManager, Platform } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'

import { AuthOnboarding } from '~/components/auth/AuthOnboarding'
import { NativeBootPlaceholder } from '~/components/brand/NativeBootPlaceholder'
import {
  hasSeenAppOnboarding,
  markAppOnboardingSeen,
} from '~/lib/onboarding/first-launch'

type NativeAppOnboardingGateProps = {
  children: ReactNode
}

function hideNativeSplash() {
  void SplashScreen.hideAsync().catch(() => {})
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
        // Fail open into onboarding so first launch never skips the intro.
        setShowIntro(true)
        setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web' || !ready) return

    // Hide splash as soon as boot UI (onboarding or app) can paint — never leave
    // a brand-magenta windowBackground stuck on screen.
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        hideNativeSplash()
      })
    })
    return () => {
      task.cancel()
    }
  }, [ready, showIntro])

  useEffect(() => {
    if (Platform.OS === 'web') return
    // Hard failsafe — never leave splash / magenta window longer than 2.5s.
    const timer = setTimeout(() => {
      hideNativeSplash()
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  if (Platform.OS === 'web') {
    return <>{children}</>
  }

  if (!ready) {
    return <NativeBootPlaceholder />
  }

  if (showIntro) {
    return (
      <AuthOnboarding
        variant="app"
        onFinish={() => {
          setShowIntro(false)
          void markAppOnboardingSeen()
          hideNativeSplash()
        }}
      />
    )
  }

  return <>{children}</>
}
