import { XStack, YStack } from '~/components/ui'

import { VideoTile } from './VideoTile'
import type { RemoteParticipantState } from '~/co-work/lib/types'

type MeetingVideoGridProps = {
  localName: string
  localAvatar?: string | null
  localStream?: MediaStream | null
  audioEnabled: boolean
  videoEnabled: boolean
  handRaised: boolean
  screenStream?: MediaStream | null
  remotePeers: Record<string, RemoteParticipantState>
  layout: 'grid' | 'speaker'
}

export function MeetingVideoGrid({
  localName,
  localAvatar,
  localStream,
  audioEnabled,
  videoEnabled,
  handRaised,
  screenStream,
  remotePeers,
  layout,
}: MeetingVideoGridProps) {
  const remotes = Object.values(remotePeers)
  const screenPeer = remotes.find((p) => p.screenSharing && p.screenStream)
  const activeScreen = screenStream ?? screenPeer?.screenStream

  if (layout === 'speaker' && (activeScreen || remotes[0])) {
    const speaker = remotes[0]
    return (
      <YStack flex={1} gap="$3" width="100%">
        <VideoTile
          large
          stream={activeScreen ?? speaker?.stream}
          name={activeScreen ? `${localName} (Screen)` : speaker?.displayName ?? 'Speaker'}
          avatarUrl={speaker?.avatarUrl}
          isScreen={!!activeScreen}
        />
        <XStack gap="$2" flexWrap="wrap">
          <VideoTile
            stream={localStream}
            name={localName}
            avatarUrl={localAvatar}
            muted={!audioEnabled}
            videoOff={!videoEnabled}
            handRaised={handRaised}
            isSelf
          />
          {remotes.slice(activeScreen ? 0 : 1).map((peer) => (
            <VideoTile
              key={peer.peerId}
              stream={peer.stream}
              name={peer.displayName}
              avatarUrl={peer.avatarUrl}
              muted={!peer.audioEnabled}
              videoOff={!peer.videoEnabled}
              handRaised={peer.handRaised}
            />
          ))}
        </XStack>
      </YStack>
    )
  }

  return (
    <XStack gap="$3" flexWrap="wrap" width="100%" justifyContent="center" alignItems="center">
      {activeScreen ? (
        <VideoTile
          large
          stream={activeScreen}
          name={`${localName} (Screen)`}
          isScreen
        />
      ) : null}
      <VideoTile
        stream={localStream}
        name={localName}
        avatarUrl={localAvatar}
        muted={!audioEnabled}
        videoOff={!videoEnabled}
        handRaised={handRaised}
        isSelf
      />
      {remotes.map((peer) => (
        <VideoTile
          key={peer.peerId}
          stream={peer.screenStream ?? peer.stream}
          name={peer.displayName}
          avatarUrl={peer.avatarUrl}
          muted={!peer.audioEnabled}
          videoOff={!peer.videoEnabled}
          handRaised={peer.handRaised}
          isScreen={!!peer.screenStream}
        />
      ))}
    </XStack>
  )
}