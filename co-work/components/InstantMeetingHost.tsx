import { useEffect } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import { Theme } from 'tamagui'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { YStack } from '~/components/ui'
import { InstantMeetingBody } from '~/co-work/components/InstantMeetingBody'
import {
  closeInstantMeetingSession,
  instantMeetingCodesMatch,
  useInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'
import { useGlobalSession } from '~/lib/session/global-session'

/** Above AppShell header/tabs (95k); below meeting portals / crop / sheets (100k+). */
const INSTANT_MEETING_FULLSCREEN_Z = 96_000

/**
 * Cross-platform instant meeting overlay (web + iOS + Android) — Zoom-style.
 *
 * Fullscreen is edge-to-edge. When the global session is minimized/pip, the
 * LiveKit body stays mounted but parked off-screen so audio continues and
 * SessionMiniPlayer Maximize restores the live room without remounting Join.
 *
 * Always use dark theme inside the meeting (Sheconomy plum palette). Following
 * the app light theme made chat composer icons/placeholder white-on-white so
 * the input looked "missing".
 */
export function InstantMeetingHost() {
  const session = useInstantMeetingSession()
  const globalSession = useGlobalSession()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()

  const presentation = globalSession?.presentation ?? 'fullscreen'
  const sameMeeting =
    !!session &&
    !!globalSession &&
    globalSession.kind === 'meeting' &&
    instantMeetingCodesMatch(globalSession.code, session.code)
  // Park off-screen only when THIS meeting is in the floating bubble / PiP.
  const collapsed =
    sameMeeting && (presentation === 'minimized' || presentation === 'pip')

  useEffect(() => {
    if (!session || Platform.OS === 'web') return
    let cancelled = false
    void import('~/lib/livekit/ensure-globals').then((mod) => {
      if (!cancelled) mod.ensureLiveKitGlobals()
    })
    return () => {
      cancelled = true
    }
  }, [session])

  if (!session) return null

  // Keep full layout size while minimized — never shrink/unmount LiveKit
  // (that disconnected iOS and remounted Join on Maximize).
  const parkX = Math.max(windowWidth, 1) * 1.2
  const boxWidth = Platform.OS === 'web' ? '100vw' : windowWidth
  const boxHeight = Platform.OS === 'web' ? '100dvh' : windowHeight

  return (
    <Theme name="dark">
      <YStack
        position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
        top={0}
        // Drive collapse with `left` (not transform alone). RN-web + Tamagui
        // often drop or fight transform strings, which left Maximize looking
        // like a no-op while the bubble stayed on Co-Work.
        left={collapsed ? -parkX : 0}
        width={boxWidth as never}
        height={boxHeight as never}
        maxWidth={boxWidth as never}
        zIndex={collapsed ? 1 : INSTANT_MEETING_FULLSCREEN_Z}
        opacity={1}
        pointerEvents={collapsed ? 'none' : 'auto'}
        overflow="hidden"
        backgroundColor="#10070D"
        collapsable={false}
        style={
          Platform.OS === 'web'
            ? ({
                position: 'fixed',
                top: 0,
                left: collapsed ? -parkX : 0,
                right: 'auto',
                bottom: 0,
                width: '100vw',
                height: '100dvh',
                maxHeight: '100dvh',
                maxWidth: '100vw',
              } as const)
            : undefined
        }
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
      >
        <AppErrorBoundary
          scope="InstantMeeting"
          alwaysShowError
          onDismiss={closeInstantMeetingSession}
        >
          <YStack flex={1} width="100%" height="100%" minHeight={0} collapsable={false}>
            <InstantMeetingBody session={session} onExit={closeInstantMeetingSession} />
          </YStack>
        </AppErrorBoundary>
      </YStack>
    </Theme>
  )
}
