import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useWindowDimensions } from 'react-native'

import { TrackLoop } from '@livekit/components-react'

import { useMeetingGalleryTracks } from '~/co-work/hooks/useMeetingGalleryTracks'
import { meetingGalleryLayout } from '~/co-work/lib/meeting-gallery-layout'

import { SheconomyParticipantTile } from './SheconomyParticipantTile'

/** SHEconomy-branded video gallery — Meet/Zoom tiles + WhatsApp-style 1:1 PiP. */
export function MeetingVideoStage() {
  const { width, height } = useWindowDimensions()
  const { stageTracks, pipTrack, totalTiles, isDualCall } = useMeetingGalleryTracks()

  // Match web stage chrome (header + control dock padding in LiveKitMeetingRoom.web CSS).
  const stageWidth = Math.max(width - 24, 1)
  const stageHeight = Math.max(height - 88 - 112, 1)
  const layout = useMemo(
    () =>
      meetingGalleryLayout(Math.max(stageTracks.length, 1), {
        width: stageWidth,
        height: stageHeight,
      }),
    [stageTracks.length, stageWidth, stageHeight],
  )
  const solo = (stageTracks.length <= 1 && !pipTrack) || isDualCall

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
