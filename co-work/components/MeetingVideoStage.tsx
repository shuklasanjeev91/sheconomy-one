import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useWindowDimensions } from 'react-native'

import { TrackLoop } from '@livekit/components-react'

import { useMeetingGalleryTracks } from '~/co-work/hooks/useMeetingGalleryTracks'
import { meetingGalleryLayout } from '~/co-work/lib/meeting-gallery-layout'
import { useAppLayout } from '~/hooks/useAppLayout'

import { SheconomyParticipantTile } from '~/co-work/components/SheconomyParticipantTile'

/** SHEconomy-branded video gallery — web LiveKit stage (native uses NativeLiveKitMeetingRoom). */
export function MeetingVideoStage() {
  const { isDesktop } = useAppLayout()
  const { width, height } = useWindowDimensions()
  const { stageTracks, pipTrack, totalTiles, hasScreenShare } = useMeetingGalleryTracks()

  const stageWidth = Math.max(width - (isDesktop ? 48 : 24), 160)
  const stageHeight = Math.max(height - 200, 180)
  const layout = useMemo(
    () => meetingGalleryLayout(stageTracks.length, { width: stageWidth, height: stageHeight }),
    [stageTracks.length, stageWidth, stageHeight],
  )
  const solo = stageTracks.length <= 1 && !pipTrack
  const galleryClass = hasScreenShare
    ? 'sheconomy-video-gallery sheconomy-video-gallery--screen'
    : solo
      ? 'sheconomy-video-gallery sheconomy-video-gallery--solo'
      : 'sheconomy-video-gallery'

  return (
    <div className="sheconomy-video-stage">
      <div
        className={galleryClass}
        style={
          {
            '--gallery-cols': hasScreenShare ? 1 : layout.columns,
            '--gallery-rows': hasScreenShare ? 1 : layout.rows,
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
