import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { TrackLoop } from '@livekit/components-react'

import { YStack } from '~/components/ui'
import { useMeetingGalleryTracks } from '~/co-work/hooks/useMeetingGalleryTracks'
import { meetingGalleryLayout } from '~/co-work/lib/meeting-gallery-layout'
import { useAppLayout } from '~/hooks/useAppLayout'

import { SheconomyParticipantTile } from './SheconomyParticipantTile'

/** SHEconomy-branded video gallery — fills stage like Zoom/Meet. */
export function MeetingVideoStage() {
  const { isDesktop } = useAppLayout()
  const { width, height } = useWindowDimensions()
  const { stageTracks, pipTrack, totalTiles } = useMeetingGalleryTracks()

  const isLandscape = width > height
  const layout = useMemo(
    () => meetingGalleryLayout(stageTracks.length, { isDesktop, isLandscape }),
    [stageTracks.length, isDesktop, isLandscape],
  )
  const solo = stageTracks.length <= 1 && !pipTrack

  if (Platform.OS !== 'web') {
    return (
      <YStack width="100%" height="100%" className="sheconomy-video-stage">
        <TrackLoop tracks={stageTracks}>
          <SheconomyParticipantTile />
        </TrackLoop>
      </YStack>
    )
  }

  return (
    <div className="sheconomy-video-stage">
      <div
        className={solo ? 'sheconomy-video-gallery sheconomy-video-gallery--solo' : 'sheconomy-video-gallery'}
        style={
          {
            '--gallery-cols': layout.columns,
            '--gallery-rows': layout.rows,
          } as CSSProperties
        }
      >
        <TrackLoop tracks={stageTracks}>
          <SheconomyParticipantTile />
        </TrackLoop>
      </div>

      {pipTrack ? (
        <div className="sheconomy-video-pip">
          <TrackLoop tracks={[pipTrack]}>
            <SheconomyParticipantTile />
          </TrackLoop>
        </div>
      ) : null}

      {totalTiles === 0 ? <div className="sheconomy-video-empty" /> : null}
    </div>
  )
}