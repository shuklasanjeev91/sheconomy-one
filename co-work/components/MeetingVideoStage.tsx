import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useWindowDimensions } from 'react-native'

import { TrackLoop } from '@livekit/components-react'

import { useMeetingGalleryTracks } from '~/co-work/hooks/useMeetingGalleryTracks'
import { meetingGalleryLayout } from '~/co-work/lib/meeting-gallery-layout'
import { useAppLayout } from '~/hooks/useAppLayout'

import { SheconomyParticipantTile } from './SheconomyParticipantTile'

/** SHEconomy-branded video gallery — web LiveKit stage (native uses NativeLiveKitMeetingRoom). */
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
