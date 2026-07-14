import { XStack, YStack } from '~/components/ui'

import { VideoTile } from './VideoTile'
import { chunkGalleryRows, meetingGalleryLayout } from '~/co-work/lib/meeting-gallery-layout'
import type { RemoteParticipantState } from '~/co-work/lib/types'
import { useWindowDimensions } from 'react-native'

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

type GridTile = {
  key: string
  stream?: MediaStream | null
  name: string
  avatarUrl?: string | null
  muted?: boolean
  videoOff?: boolean
  handRaised?: boolean
  isSelf?: boolean
  isScreen?: boolean
}

/** Meet/Zoom-style equal tile gallery (fallback path when LiveKit stage is unused). */
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
  const { width, height } = useWindowDimensions()
  // Approximate stage after meeting chrome (header + control dock).
  const stageWidth = Math.max(width - 24, 1)
  const stageHeight = Math.max(height - 200, 1)

  const tiles: GridTile[] = [
    {
      key: 'local',
      stream: localStream,
      name: localName,
      avatarUrl: localAvatar,
      muted: !audioEnabled,
      videoOff: !videoEnabled,
      handRaised,
      isSelf: true,
    },
    ...remotes.map((peer) => ({
      key: peer.peerId,
      stream: peer.screenStream ?? peer.stream,
      name: peer.displayName,
      avatarUrl: peer.avatarUrl,
      muted: !peer.audioEnabled,
      videoOff: !peer.videoEnabled,
      handRaised: peer.handRaised,
      isScreen: !!peer.screenStream,
    })),
  ]

  const screenPeer = remotes.find((p) => p.screenSharing && p.screenStream)
  const activeScreen = screenStream ?? screenPeer?.screenStream

  if (layout === 'speaker' && (activeScreen || remotes[0])) {
    const speaker = remotes[0]
    return (
      <YStack flex={1} gap="$2" width="100%" minHeight={0}>
        <VideoTile
          large
          stream={activeScreen ?? speaker?.stream}
          name={activeScreen ? `${localName} (Screen)` : speaker?.displayName ?? 'Speaker'}
          avatarUrl={speaker?.avatarUrl}
          isScreen={!!activeScreen}
        />
        <XStack gap="$2" flexWrap="wrap">
          {tiles.map((tile) => (
            <VideoTile
              key={tile.key}
              stream={tile.stream}
              name={tile.name}
              avatarUrl={tile.avatarUrl}
              muted={tile.muted}
              videoOff={tile.videoOff}
              handRaised={tile.handRaised}
              isSelf={tile.isSelf}
              isScreen={tile.isScreen}
            />
          ))}
        </XStack>
      </YStack>
    )
  }

  // WhatsApp / Meet 1:1 — remote fills the stage, local floats as PiP.
  const remote = remotes[0]
  if (!activeScreen && remotes.length === 1 && remote) {
    const pipWidth = Math.min(width >= 768 ? 240 : 148, Math.floor(stageWidth * (width >= 768 ? 0.28 : 0.4)))
    return (
      <YStack flex={1} width="100%" height="100%" minHeight={0} position="relative">
        <VideoTile
          large
          stream={remote.stream}
          name={remote.displayName}
          avatarUrl={remote.avatarUrl}
          muted={!remote.audioEnabled}
          videoOff={!remote.videoEnabled}
          handRaised={remote.handRaised}
        />
        <YStack
          position="absolute"
          right={12}
          bottom={12}
          width={pipWidth}
          aspectRatio={16 / 9}
          zIndex={20}
          borderRadius={16}
          overflow="hidden"
        >
          <VideoTile
            large
            stream={localStream}
            name={localName}
            avatarUrl={localAvatar}
            muted={!audioEnabled}
            videoOff={!videoEnabled}
            handRaised={handRaised}
            isSelf
          />
        </YStack>
      </YStack>
    )
  }

  const galleryTiles = tiles
  const gallery = meetingGalleryLayout(Math.max(galleryTiles.length, 1), {
    width: stageWidth,
    height: stageHeight,
  })
  const rows = chunkGalleryRows(galleryTiles, gallery.columns)
  const solo = galleryTiles.length <= 1

  return (
    <YStack flex={1} width="100%" height="100%" gap={10} minHeight={0}>
      {activeScreen ? (
        <YStack flex={solo ? 1 : 2} minHeight={0} width="100%">
          <VideoTile large stream={activeScreen} name={`${localName} (Screen)`} isScreen />
        </YStack>
      ) : null}
      {rows.map((row, rowIndex) => {
        const incomplete = row.length < gallery.columns
        const tileWidth =
          (stageWidth - 10 * Math.max(gallery.columns - 1, 0)) / gallery.columns
        return (
          <XStack
            key={`row-${rowIndex}`}
            flex={1}
            width="100%"
            gap={10}
            minHeight={0}
            justifyContent={incomplete ? 'center' : 'flex-start'}
          >
            {row.map((tile) => (
              <YStack
                key={tile.key}
                flex={incomplete ? undefined : 1}
                width={incomplete ? tileWidth : undefined}
                minWidth={0}
                minHeight={0}
              >
                <VideoTile
                  large
                  stream={tile.stream}
                  name={tile.name}
                  avatarUrl={tile.avatarUrl}
                  muted={tile.muted}
                  videoOff={tile.videoOff}
                  handRaised={tile.handRaised}
                  isSelf={tile.isSelf}
                  isScreen={tile.isScreen}
                />
              </YStack>
            ))}
          </XStack>
        )
      })}
    </YStack>
  )
}
