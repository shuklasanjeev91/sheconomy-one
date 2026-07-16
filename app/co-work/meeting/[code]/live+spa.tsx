import { useLocalSearchParams } from 'one'

import { MeetingLobbyScreen } from '~/co-work/screens/MeetingLobbyScreen'

function readRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default function CoWorkMeetingLiveRoute() {
  const params = useLocalSearchParams<{ code: string | string[] }>()
  const code = readRouteParam(params.code)
  return <MeetingLobbyScreen code={code} startLive />
}
