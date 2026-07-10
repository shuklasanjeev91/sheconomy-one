import { useEffect, useState } from 'react'

import { Spinner, Text } from '~/components/ui'
import { ScreenCenter, ScreenFill } from '~/components/layout'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { supportsLiveKitVideo } from '~/lib/platform/capabilities'

import type { LiveKitMeetingRoomProps } from '~/co-work/lib/livekit-media-controls'

export function NativeLiveKitMeetingRoomLoader(props: LiveKitMeetingRoomProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [NativeRoom, setNativeRoom] = useState<
    typeof import('./NativeLiveKitMeetingRoom').NativeLiveKitMeetingRoom | null
  >(null)

  useEffect(() => {
    void import('./NativeLiveKitMeetingRoom').then((module) => {
      setNativeRoom(() => module.NativeLiveKitMeetingRoom)
    })
  }, [])

  if (!supportsLiveKitVideo()) {
    return (
      <ScreenFill padding="$5" alignItems="center" justifyContent="center" backgroundColor={coworkUi.pageBg}>
        <Text color={coworkUi.textSecondary} textAlign="center">
          Video meetings are not available on this device.
        </Text>
      </ScreenFill>
    )
  }

  if (!NativeRoom) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg}>
        <Spinner size="large" color={coworkUi.brand} />
      </ScreenCenter>
    )
  }

  return <NativeRoom {...props} />
}
