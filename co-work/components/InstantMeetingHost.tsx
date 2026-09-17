import { useEffect, useState, type ComponentType } from 'react'
import { Platform } from 'react-native'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { Spinner, Text, YStack } from '~/components/ui'
import type { InstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import {
  closeInstantMeetingSession,
  useInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'
import { useGlobalSession } from '~/lib/session/global-session'

type InstantMeetingBodyComponent = ComponentType<{
  session: InstantMeetingSession
  onExit: () => void
}>

/**
 * Cross-platform instant meeting overlay (web + iOS + Android).
 *
 * When the global session is minimized/pip, the LiveKit body stays mounted
 * (hidden) so audio continues while SessionMiniPlayer / other tabs are usable.
 * Fullscreen presentation covers the shell like before.
 */
export function InstantMeetingHost() {
  const session = useInstantMeetingSession()
  const globalSession = useGlobalSession()
  const [Body, setBody] = useState<InstantMeetingBodyComponent | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const presentation = globalSession?.presentation ?? 'fullscreen'
  const collapsed = presentation === 'minimized' || presentation === 'pip'
  // Only host media for this meeting code when global session matches (or none yet).
  const ownsSession =
    !globalSession ||
    globalSession.kind !== 'meeting' ||
    !session ||
    globalSession.code === session.code.replace(/\s/g, '').trim()

  useEffect(() => {
    if (!session || !ownsSession) {
      setBody(null)
      setLoadError(null)
      return
    }

    let cancelled = false
    setLoadError(null)

    void (async () => {
      try {
        if (Platform.OS !== 'web') {
          // Register WebRTC globals before the body pulls LiveKit in.
          const { ensureLiveKitGlobals } = await import('~/lib/livekit/ensure-globals')
          ensureLiveKitGlobals()
        }

        // Dynamic import keeps LiveKit out of the AppShell graph until open.
        // Use ESM `import()` — web Vite has no CommonJS `require`.
        const mod = await import('~/co-work/components/InstantMeetingBody')
        if (!cancelled) setBody(() => mod.InstantMeetingBody)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to open meeting')
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // Only remount when the meeting code changes — not on every session object tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownsSession, session?.code])

  if (!session || !ownsSession) return null

  return (
    <YStack
      position="absolute"
      top={collapsed ? -4 : 0}
      left={collapsed ? -4 : 0}
      right={collapsed ? undefined : 0}
      bottom={collapsed ? undefined : 0}
      width={collapsed ? 4 : '100%'}
      height={collapsed ? 4 : '100%'}
      zIndex={collapsed ? 1 : 100000}
      opacity={collapsed ? 0 : 1}
      pointerEvents={collapsed ? 'none' : 'auto'}
      overflow="hidden"
      backgroundColor="#0c080a"
      accessibilityElementsHidden={collapsed}
      importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
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
