import { useEffect, useState, type ComponentType } from 'react'
import { Platform } from 'react-native'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { Spinner, Text, YStack } from '~/components/ui'
import type { InstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import {
  closeInstantMeetingSession,
  useInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'

type InstantMeetingBodyComponent = ComponentType<{
  session: InstantMeetingSession
  onExit: () => void
}>

/**
 * Cross-platform instant meeting overlay (web + iOS + Android).
 *
 * - Web: no-op — Co-Work navigates to `/meeting/:code/live`.
 * - Native: keep this file free of LiveKit. AppShell mounts the host on every
 *   screen; a static InstantMeetingBody import evaluates WebRTC at cold start
 *   and blanks the UI after splash. Load the body only when a session opens.
 */
export function InstantMeetingHost() {
  const session = useInstantMeetingSession()
  const [Body, setBody] = useState<InstantMeetingBodyComponent | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (Platform.OS === 'web' || !session) {
      setBody(null)
      setLoadError(null)
      return
    }

    let cancelled = false
    setLoadError(null)

    try {
      // Ensure Hermes globals before LiveKit/WebRTC evaluate.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { installDOMExceptionPolyfill } = require('~/lib/polyfills/dom-exception') as {
        installDOMExceptionPolyfill: () => void
      }
      installDOMExceptionPolyfill()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ensureLiveKitNativeGlobals } = require('~/lib/livekit/register-native-globals') as {
        ensureLiveKitNativeGlobals: () => void
      }
      ensureLiveKitNativeGlobals()

      // Sync require keeps LiveKit out of the AppShell module graph until open.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('~/co-work/components/InstantMeetingBody') as {
        InstantMeetingBody: InstantMeetingBodyComponent
      }
      if (!cancelled) setBody(() => mod.InstantMeetingBody)
    } catch (error) {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : 'Failed to open meeting')
      }
    }

    return () => {
      cancelled = true
    }
  }, [session])

  if (Platform.OS === 'web' || !session) return null

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      width="100%"
      height="100%"
      zIndex={100000}
      backgroundColor="#0c080a"
    >
      <AppErrorBoundary scope="InstantMeeting" alwaysShowError>
        {!Body ? (
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$4" padding="$6">
            {loadError ? (
              <>
                <Text color="#fff" fontSize={22} fontWeight="800" textAlign="center" letterSpacing={-0.3}>
                  Could not open meeting
                </Text>
                <Text color="#f5a3c0" textAlign="center" fontSize={14} lineHeight={20} maxWidth={340}>
                  {loadError}
                </Text>
                <Text
                  color="#fff"
                  fontWeight="600"
                  textDecorationLine="underline"
                  onPress={closeInstantMeetingSession}
                  marginTop="$2"
                  accessibilityRole="button"
                >
                  Back to Co-Work
                </Text>
              </>
            ) : (
              <>
                <Spinner size="large" color="#D81B60" />
                <Text color="#ccc" fontSize={15}>
                  Starting meeting…
                </Text>
              </>
            )}
          </YStack>
        ) : (
          <Body session={session} onExit={closeInstantMeetingSession} />
        )}
      </AppErrorBoundary>
    </YStack>
  )
}
