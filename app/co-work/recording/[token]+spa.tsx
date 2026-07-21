import { useLocalSearchParams } from 'one'

import { MeetingRecordingPlaybackScreen } from '~/co-work/screens/MeetingRecordingPlaybackScreen'

function readRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default function CoWorkRecordingShareRoute() {
  const params = useLocalSearchParams<{ token: string | string[] }>()
  const token = readRouteParam(params.token)
  return <MeetingRecordingPlaybackScreen token={token} />
}
