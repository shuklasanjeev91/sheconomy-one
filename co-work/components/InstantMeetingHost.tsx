import { useEffect } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import { Theme, useThemeName } from 'tamagui'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { YStack } from '~/components/ui'
import { InstantMeetingBody } from '~/co-work/components/InstantMeetingBody'
import {
  closeInstantMeetingSession,
  instantMeetingCodesMatch,
  useInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'
import { useGlobalSession } from '~/lib/session/global-session'

/** Above AppShell header/tabs (95k); below meeting portals / crop (100k+). */
const INSTANT_MEETING_FULLSCREEN_Z = 96_000

/**
 * Cross-platform instant meeting overlay (web + iOS + Android).
 *
 * Fullscreen is edge-to-edge (no app header / bottom tabs). When the global
 * session is minimized/pip, the LiveKit body stays mounted (hidden) so audio
 * continues while SessionMiniPlayer / other tabs are usable.
 *
 * InstantMeetingBody is a static import on purpose: a dynamic `import()` put
 * meeting chrome (lucide Icons → helpers-icon → core) in an async chunk that
 * could bind a second Tamagui Theme context and crash Join with "Missing theme.".
 */
export function InstantMeetingHost() {
  const session = useInstantMeetingSession()
  const globalSession = useGlobalSession()
  const themeName = useThemeName()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()

  const presentation = globalSession?.presentation ?? 'fullscreen'
  const sameMeeting =
    !!session &&
    !!globalSession &&
    globalSession.kind === 'meeting' &&
    instantMeetingCodesMatch(globalSession.code, session.code)
  // Only park off-screen when THIS meeting is in bubble/PiP. An unrelated
  // minimized call must not collapse a live Co-Work overlay.
  const collapsed =
    sameMeeting && (presentation === 'minimized' || presentation === 'pip')

  // Instant overlay is the source of truth for LiveKit. Never tear it down just
  // because global session code formatting briefly mismatches — that remounted
  // MeetingLiveScreen on the Join confirm screen after Maximize.
  //
  // Important: do NOT hide this overlay (opacity 0) on a code-shape mismatch
  // while fullscreen. Chromeless shell stays on whenever an instant session
  // exists, so hiding the host left a blank white iPad viewport with only the
  // AI FAB / stray chrome visible.

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

  // Keep the LiveKit surface "rendered" while minimized. `visibility:hidden`
  // / opacity:0 can pause camera capture on web and native WebRTC. Park the
  // overlay off-screen instead so publishing continues for the bubble.
  const collapsedStyle =
    Platform.OS === 'web'
      ? ({
          transform: collapsed ? 'translate3d(-120vw, 0, 0)' : 'translate3d(0, 0, 0)',
          pointerEvents: collapsed ? ('none' as const) : ('auto' as const),
        } as const)
      : ({
          transform: collapsed
            ? [{ translateX: -Math.max(windowWidth, 1) * 1.2 }]
            : [{ translateX: 0 }],
        } as const)

  return (
    <Theme name={themeName}>
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        width="100%"
        height="100%"
        zIndex={collapsed ? 1 : INSTANT_MEETING_FULLSCREEN_Z}
        opacity={1}
        pointerEvents={collapsed ? 'none' : 'auto'}
        overflow="hidden"
        backgroundColor="#0c080a"
        collapsable={false}
        style={{
          ...overlayStyle,
          ...collapsedStyle,
          ...(collapsed
            ? null
            : Platform.OS === 'web'
              ? ({ width: '100vw', height: '100dvh', maxWidth: '100vw' } as const)
              : ({ width: windowWidth, height: windowHeight, maxWidth: windowWidth } as const)),
        }}
        accessibilityElementsHidden={collapsed}
        importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
      >
        <AppErrorBoundary scope="InstantMeeting" alwaysShowError>
          <YStack flex={1} width="100%" height="100%" minHeight={0} collapsable={false}>
            <InstantMeetingBody session={session} onExit={closeInstantMeetingSession} />
          </YStack>
        </AppErrorBoundary>
      </YStack>
    </Theme>
  )
}
