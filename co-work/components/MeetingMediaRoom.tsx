import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { Button, Spinner, Text, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill, ViewportOverlay } from '~/components/layout'
import { MediasoupMeetingRoom } from '~/co-work/components/MediasoupMeetingRoom'
import type { MeetingRoomProps } from '~/co-work/lib/meeting-media-controls'
import {
  fetchMediasoupCredentials,
  type MediasoupCredentials,
} from '~/co-work/lib/mediasoup/mediasoup-credentials'
import { randomMediasoupSession } from '~/co-work/lib/mediasoup/peer-identity'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { coworkBoxShadow } from '~/lib/platform/crossStyles'

type MediaRoomState =
  | { kind: 'loading' }
  | { kind: 'mediasoup'; credentials: MediasoupCredentials }
  | { kind: 'error'; message: string }

/** Meeting audio/video on the mediasoup SFU. */
export function MeetingMediaRoom(props: MeetingRoomProps) {
  const { meetingId, roomId, enabled, displayName, avatarUrl, overlay } = props
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()
  const [state, setState] = useState<MediaRoomState>({ kind: 'loading' })
  const [session] = useState(randomMediasoupSession)
  // Name / avatar arriving later must not refetch and rejoin mid-meeting.
  const profileRef = useRef({ displayName, avatarUrl })
  profileRef.current = { displayName, avatarUrl }

  const load = useCallback(async () => {
    if (!enabled || !roomId) return
    setState({ kind: 'loading' })
    try {
      const credentials = await fetchMediasoupCredentials({
        meetingId,
        roomName: roomId,
        displayName: profileRef.current.displayName,
        avatarUrl: profileRef.current.avatarUrl,
        session,
      })
      setState({ kind: 'mediasoup', credentials })
    } catch (cause) {
      setState({
        kind: 'error',
        message: cause instanceof Error ? cause.message : 'Could not join the video room.',
      })
    }
  }, [enabled, meetingId, roomId, session])

  useEffect(() => {
    void load()
  }, [load])

  if (state.kind === 'mediasoup') {
    return <MediasoupMeetingRoom {...props} credentials={state.credentials} />
  }

  if (state.kind === 'error') {
    const message = /non-2xx|Edge Function/i.test(state.message)
      ? 'Could not join the video room. Check your connection and try again.'
      : state.message
    return (
      <ScreenFill padding="$4" backgroundColor={coworkUi.pageBg} position="relative">
        {overlay?.(null)}
        <ViewportOverlay>
          <YStack
            position={(Platform.OS === 'web' ? 'fixed' : 'absolute') as never}
            top={0}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            justifyContent="center"
            padding="$6"
            zIndex={200_000}
            pointerEvents="box-none"
          >
            <YStack
              maxWidth={420}
              width="100%"
              gap="$3"
              padding="$5"
              borderRadius={coworkUi.radius.panel}
              backgroundColor={coworkUi.surface}
              borderWidth={1}
              borderColor={coworkUi.glassBorder}
              pointerEvents="auto"
              style={coworkBoxShadow(coworkShadows, 'panel')}
            >
              <Text color={coworkUi.danger} fontWeight="800" fontSize={18}>
                Could not join video room
              </Text>
              <Text color={coworkUi.textSecondary} lineHeight={22}>
                {message}
              </Text>
              <Button tone="primary" borderRadius={999} onPress={() => void load()}>
                Try again
              </Button>
            </YStack>
          </YStack>
        </ViewportOverlay>
      </ScreenFill>
    )
  }

  if (!roomId) {
    return (
      <ScreenFill padding="$4" backgroundColor={coworkUi.pageBg}>
        <Text color={coworkUi.danger}>Meeting room is not ready. Refresh and try again.</Text>
      </ScreenFill>
    )
  }

  return (
    <ScreenCenter backgroundColor={coworkUi.pageBg}>
      <Spinner size="large" color={coworkUi.brandLight} />
      <Text color={coworkUi.textSecondary} marginTop="$3">
        Joining Co-Work room…
      </Text>
    </ScreenCenter>
  )
}
