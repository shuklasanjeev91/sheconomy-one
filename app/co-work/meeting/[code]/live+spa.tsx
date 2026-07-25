import { useLocalSearchParams, useParams, usePathname } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { ScreenCenter } from '~/components/layout'
import { Text } from '~/components/ui'
import { MeetingLiveScreen } from '~/co-work/screens/MeetingLiveScreen'

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
 */
export default function CoWorkMeetingLiveRoute() {
  const code = useMeetingCode()

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
      <MeetingLiveScreen code={code} />
    </AppErrorBoundary>
  )
}
