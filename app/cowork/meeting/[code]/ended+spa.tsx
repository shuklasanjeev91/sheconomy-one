import { useLocalSearchParams, useParams, usePathname } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { ScreenCenter } from '~/components/layout'
import { Text } from '~/components/ui'
import { MeetingEndedScreen } from '~/co-work/screens/MeetingEndedScreen'
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

/** Alias route for /cowork/meeting/:code/ended */
export default function CoworkMeetingEndedRoute() {
  const code = useMeetingCode()
  if (!code) {
    return (
      <ScreenCenter backgroundColor="#D81B60">
        <Text color="#fff" fontWeight="700" fontSize={16} textAlign="center" paddingHorizontal="$6">
          This meeting has ended.
        </Text>
      </ScreenCenter>
    )
  }
  return (
    <AppErrorBoundary scope="CoWorkMeetingEnded" alwaysShowError>
      <MeetingEndedScreen onDone={() => navigateApp(coWorkRoutes.home)} />
    </AppErrorBoundary>
  )
}
