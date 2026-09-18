import { useEffect } from 'react'
import { useLocalSearchParams, useParams, usePathname } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { ScreenCenter } from '~/components/layout'
import { Spinner, Text, YStack } from '~/components/ui'
import {
  instantMeetingCodesMatch,
  openInstantMeetingSession,
  peekInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'
import { maximizeGlobalSession, peekGlobalSession } from '~/lib/session/global-session'
import { coWorkRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'

function readRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function useMeetingCode(): string {
  const routeParams = useParams<{ code?: string | string[] }>()
  const localParams = useLocalSearchParams<{ code?: string | string[] }>()
  const pathname = usePathname() ?? ''
  const fromParams =
    readRouteParam(routeParams.code) || readRouteParam(localParams.code)
  if (fromParams) return fromParams
  const match = pathname.match(/\/co-?work\/meeting\/([^/?#]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

/**
 * Live room deep link — always hand off to InstantMeetingHost so the room is
 * edge-to-edge (no SHE header / Co-Work tabs / page gutters). Rendering
 * MeetingLiveScreen as an AppShell child left white side rails on phone/tablet.
 */
export default function CoWorkMeetingLiveRoute() {
  const code = useMeetingCode()

  useEffect(() => {
    if (!code) return
    const instant = peekInstantMeetingSession()
    const global = peekGlobalSession()
    const sameInstant = !!(instant && instantMeetingCodesMatch(instant.code, code))
    openInstantMeetingSession({
      code,
      meeting: sameInstant ? instant?.meeting ?? null : null,
      autoJoin: true,
      enteredRoom: sameInstant ? !!instant?.enteredRoom : false,
      displayName: sameInstant ? instant?.displayName ?? null : null,
    })
    maximizeGlobalSession()
    // Leave the inset /live route so only the fullscreen overlay remains.
    if (global?.presentation === 'minimized' || global?.presentation === 'pip' || sameInstant) {
      navigateApp(coWorkRoutes.home)
      return
    }
    navigateApp(coWorkRoutes.meetings)
  }, [code])

  if (!code) {
    return (
      <ScreenCenter backgroundColor="#0c080a">
        <Text color="#fff" fontWeight="700" fontSize={16} textAlign="center" paddingHorizontal="$6">
          Missing meeting code. Go back to Co-Work and try again.
        </Text>
      </ScreenCenter>
    )
  }

  return (
    <AppErrorBoundary scope="CoWorkMeetingLive" alwaysShowError>
      <YStack flex={1} width="100%" height="100%" backgroundColor="#0c080a" alignItems="center" justifyContent="center">
        <Spinner size="large" color="#D81B60" />
        <Text color="#ccc" marginTop="$3" fontSize={14}>
          Opening meeting…
        </Text>
      </YStack>
    </AppErrorBoundary>
  )
}
