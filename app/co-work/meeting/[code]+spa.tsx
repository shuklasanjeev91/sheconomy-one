import { useLocalSearchParams, useParams, usePathname } from 'one'

import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { MeetingLobbyScreen } from '~/co-work/screens/MeetingLobbyScreen'

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
 * SPA lobby — avoid Vite SSR + deps_ssr pre-bundle thrash when mediasoup /
 * expo-image-manipulator first load (outdated pre-bundle → forced reload errors).
 * Open Graph SEO for share links can be restored via a lightweight edge meta route later.
 */
export default function CoWorkMeetingLobbyRoute() {
  const code = useMeetingCode()

  return (
    <AppErrorBoundary scope="CoWorkMeeting">
      <MeetingLobbyScreen code={code} />
    </AppErrorBoundary>
  )
}
