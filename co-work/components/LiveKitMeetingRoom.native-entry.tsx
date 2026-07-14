import { Spinner, Text } from '~/components/ui'
import { ScreenFill } from '~/components/layout'
import { NativeLiveKitMeetingRoom } from '~/co-work/components/NativeLiveKitMeetingRoom'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { supportsLiveKitVideo } from '~/lib/platform/capabilities'

import type { LiveKitMeetingRoomProps } from '~/co-work/lib/livekit-media-controls'

/**
 * Native LiveKit entry. Keep a static import so Metro does not emit a lazy
 * chunk (Hermes fails those with SyntaxError: 'identifier' expected).
 * WebRTC globals are registered inside NativeLiveKitMeetingRoom on first load,
 * not at app cold start.
 */
export function NativeLiveKitMeetingRoomLoader(props: LiveKitMeetingRoomProps) {
  const { ui: coworkUi } = useCoWorkTheme()

  if (!supportsLiveKitVideo()) {
    return (
      <ScreenFill padding="$5" alignItems="center" justifyContent="center" backgroundColor={coworkUi.pageBg}>
        <Text color={coworkUi.textSecondary} textAlign="center">
          Video meetings are not available on this device.
        </Text>
      </ScreenFill>
    )
  }

  return <NativeLiveKitMeetingRoom {...props} />
}
