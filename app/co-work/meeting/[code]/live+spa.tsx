import { useEffect } from 'react'
import { useLocalSearchParams, useParams, usePathname } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { ScreenCenter } from '~/components/layout'
import { Text } from '~/components/ui'
import {
  instantMeetingCodesMatch,
  openInstantMeetingSession,
  peekInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'
import { MeetingLiveScreen } from '~/co-work/screens/MeetingLiveScreen'
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
  const match = pathname.match(/\/co-work\/meeting\/([^/?#]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

/**
 * Live room route — LiveKit only loads when this path is opened.
 * Keep lobby / Co-Work home free of this import.
 *
 * If InstantMeetingHost already owns this meeting (minimize → maximize / deep
 * link while live), expand that overlay instead of mounting a second Join flow.
 */
export default function CoWorkMeetingLiveRoute() {
  const code = useMeetingCode()

  useEffect(() => {
    if (!code) return
    const instant = peekInstantMeetingSession()
    const global = peekGlobalSession()
    const sameInstant = !!(instant && instantMeetingCodesMatch(instant.code, code))
    const sameGlobal =
      global?.kind === 'meeting' && instantMeetingCodesMatch(global.code, code)
    if (!sameInstant && !sameGlobal) return
    if (instant?.enteredRoom || global?.presentation === 'minimized' || global?.presentation === 'pip') {
      openInstantMeetingSession({
        code,
        meeting: instant?.meeting ?? null,
        autoJoin: true,
        enteredRoom: true,
        displayName: instant?.displayName ?? null,
      })
      maximizeGlobalSession()
      navigateApp(coWorkRoutes.home)
    }
  }, [code])

  if (!code) {
    return (
      <ScreenCenter backgroundColor="#D81B60">
        <Text color="#fff" fontWeight="700" fontSize={16} textAlign="center" paddingHorizontal="$6">
          Missing meeting code. Go back to Co-Work and try again.
        </Text>
      </ScreenCenter>
    )
  }

  return (
    <AppErrorBoundary scope="CoWorkMeetingLive" alwaysShowError>
      <MeetingLiveScreen code={code} autoJoin />
    </AppErrorBoundary>
  )
}
