import { useEffect, useState, type ComponentType } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { Button, Spinner, Text, YStack } from '~/components/ui'
import type { InstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import {
  closeInstantMeetingSession,
  normalizeInstantMeetingCode,
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
 * Fullscreen is edge-to-edge (no app header / bottom tabs). When the global
 * session is minimized/pip, the LiveKit body stays mounted (hidden) so audio
 * continues while SessionMiniPlayer / other tabs are usable.
 */
export function InstantMeetingHost() {
  const session = useInstantMeetingSession()
  const globalSession = useGlobalSession()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [Body, setBody] = useState<InstantMeetingBodyComponent | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const presentation = globalSession?.presentation ?? 'fullscreen'
  const collapsed = presentation === 'minimized' || presentation === 'pip'

  // Instant overlay is the source of truth for LiveKit. Never tear it down just
  // because global session code formatting briefly mismatches — that remounted
  // MeetingLiveScreen on the Join confirm screen after Maximize.
  //
  // Important: do NOT hide this overlay (opacity 0) on a code-shape mismatch
  // while fullscreen. Chromeless shell stays on whenever an instant session
  // exists, so hiding the host left a blank white iPad viewport with only the
  // AI FAB / stray chrome visible.

  const sessionCodeKey = session ? normalizeInstantMeetingCode(session.code) : null

  useEffect(() => {
    if (!session) {
      setBody(null)
      setLoadError(null)
      return
    }

    let cancelled = false
    setLoadError(null)

    void (async () => {
      try {
        if (Platform.OS !== 'web') {
          const { ensureLiveKitGlobals } = await import('~/lib/livekit/ensure-globals')
          ensureLiveKitGlobals()
        }

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
    // Remount only when the *normalized* meeting identity changes — not when
    // dashed ↔ plain code formatting is reconciled on the same meeting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCodeKey])

  if (!session) return null

  // Keep full layout size while minimized — only hide visually. Off-screen /
  // shrunk surfaces disconnect LiveKit on iOS and remount Join on Maximize.
  //
  // Web desktop uses document flow (parent may not be 100dvh). Absolute fill
  // then collapses to zero height — New meeting looked like a reload with no UI.
  // Fixed inset covers the viewport regardless of shell chrome flips.
  const overlayStyle =
    Platform.OS === 'web'
      ? ({
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100dvh',
          maxHeight: '100dvh',
        } as const)
      : ({
          // Explicit window box — parent flex alone can collapse to 0 on iPad
          // landscape when the shell flips chromeless during join.
          width: windowWidth,
          height: windowHeight,
        } as const)

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      width="100%"
      height="100%"
      zIndex={collapsed ? 1 : 90_000}
      opacity={collapsed ? 0 : 1}
      pointerEvents={collapsed ? 'none' : 'auto'}
      overflow="hidden"
      backgroundColor="#0c080a"
      collapsable={false}
      style={overlayStyle}
      accessibilityElementsHidden={collapsed}
      importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
    >
      <AppErrorBoundary scope="InstantMeeting" alwaysShowError>
        {!Body ? (
          <YStack
            flex={1}
            width="100%"
            height="100%"
            alignItems="center"
            justifyContent="center"
            gap="$4"
            padding="$6"
          >
            {loadError ? (
              <>
                <Text color="#fff" fontSize={22} fontWeight="800" textAlign="center" letterSpacing={-0.3}>
                  Could not open meeting
                </Text>
                <Text color="#f5a3c0" textAlign="center" fontSize={14} lineHeight={20} maxWidth={340}>
                  {loadError}
                </Text>
                <Button
                  tone="primary"
                  size="$4"
                  borderRadius={999}
                  width="100%"
                  maxWidth={360}
                  onPress={closeInstantMeetingSession}
                  accessibilityLabel="Back to Co-Work"
                >
                  Back to Co-Work
                </Button>
              </>
            ) : (
              <>
                <Spinner size="large" color="#D81B60" />
                <Text color="#ccc" fontSize={15}>
                  Starting meeting…
                </Text>
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={999}
                  borderColor="rgba(255,255,255,0.35)"
                  color="#fff"
                  marginTop="$2"
                  onPress={closeInstantMeetingSession}
                  accessibilityLabel="Back to Co-Work"
                >
                  Back to Co-Work
                </Button>
              </>
            )}
          </YStack>
        ) : (
          <YStack flex={1} width="100%" height="100%" minHeight={0} collapsable={false}>
            <Body session={session} onExit={closeInstantMeetingSession} />
          </YStack>
        )}
      </AppErrorBoundary>
    </YStack>
  )
}
