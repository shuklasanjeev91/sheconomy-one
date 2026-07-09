import { useLocalSearchParams } from 'one'

import { MeetingLobbyScreen } from '~/co-work/screens/MeetingLobbyScreen'

export default function CoWorkMeetingLiveRoute() {
  const params = useLocalSearchParams<{ code: string }>()
  const code = params.code ?? ''
  return <MeetingLobbyScreen code={code} startLive />
}