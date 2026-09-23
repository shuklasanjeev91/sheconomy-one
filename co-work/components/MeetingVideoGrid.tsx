import { XStack, YStack } from '~/components/ui'

import { VideoTile } from '~/co-work/components/VideoTile'
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
  // Approximate stage after meeting UI (header + control dock).
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

  if (layout === 'speaker' && (activeScreen || remotes.length > 0 || tiles.length > 0)) {
    const speakingRemote =
      [...remotes].sort((left, right) => {
        // Prefer unmuted speakers when media stream audio isn't leveled here.
        return Number(right.audioEnabled) - Number(left.audioEnabled)
      })[0] ?? null
    const speakerTile =
      tiles.find((tile) => !tile.isSelf && tile.key === speakingRemote?.peerId) ??
      tiles.find((tile) => !tile.isSelf) ??
      tiles[0]
    const filmstrip = tiles.filter((tile) => tile.key !== speakerTile?.key)
    return (
      <YStack flex={1} gap="$2" width="100%" minHeight={0}>
        {speakerTile ? (
          <YStack flex={1} minHeight={0} width="100%">
            <VideoTile
              large
              stream={activeScreen ?? speakerTile.stream}
              name={
                activeScreen
                  ? `${localName} (Screen)`
                  : speakerTile.name
              }
              avatarUrl={speakerTile.avatarUrl}
              muted={speakerTile.muted}
              videoOff={speakerTile.videoOff}
              handRaised={speakerTile.handRaised}
              isSelf={speakerTile.isSelf}
              isScreen={!!activeScreen}
            />
          </YStack>
        ) : null}
        {filmstrip.length > 0 ? (
          <XStack gap="$2" flexWrap="nowrap" overflow="hidden">
            {filmstrip.map((tile) => (
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
        ) : null}
      </YStack>
    )
  }

  // True gallery — two (or more) equal large tiles. Never float local as PiP.
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
