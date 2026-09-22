import { useEffect, useRef, useState } from 'react'
import { isTrackReference, type TrackReferenceOrPlaceholder } from '@livekit/components-core'

import {
  screenShareStreamForTrack,
  screenShareVideoHasFrames,
} from '~/co-work/lib/web-screen-share-video'

/**
 * Android MediaProjection often delivers RemoteVideoTrack before any pixels.
 * LiveKit's VideoTrack attaches once and never retries, so web stays black.
 * Keep re-attaching until the element reports a real frame size.
 */
export function MeetingScreenShareVideo({
  trackRef,
}: {
  trackRef: TrackReferenceOrPlaceholder
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasFrames, setHasFrames] = useState(false)
  const publication = isTrackReference(trackRef) ? trackRef.publication : null
  const track = publication?.track ?? null
  const mediaTrack = track?.mediaStreamTrack ?? null
  const streamId = track?.mediaStream?.id ?? mediaTrack?.id ?? null

  useEffect(() => {
    setHasFrames(false)
    const el = videoRef.current
    if (!el || !mediaTrack) return

    const apply = () => {
      const stream = screenShareStreamForTrack({
        mediaStream: track?.mediaStream as MediaStream | null,
        mediaStreamTrack: mediaTrack,
      })
      if (stream && el.srcObject !== stream) el.srcObject = stream
      el.muted = true
      el.autoplay = true
      el.playsInline = true
      void el.play().catch(() => {})
      if (screenShareVideoHasFrames(el)) setHasFrames(true)
    }

    apply()
    el.addEventListener('loadeddata', apply)
    el.addEventListener('resize', apply)
    const poll = window.setInterval(apply, 400)
    return () => {
      el.removeEventListener('loadeddata', apply)
      el.removeEventListener('resize', apply)
      window.clearInterval(poll)
      el.srcObject = null
    }
  }, [mediaTrack, streamId, track])

  return (
    <>
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className="lk-video-track"
        data-lk-source="screen_share"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: '#0c080a',
          opacity: hasFrames ? 1 : 0,
        }}
      />
      {!hasFrames ? (
        <div className="lk-participant-placeholder sheconomy-screen-waiting" data-camera-off="false">
          <span className="sheconomy-participant-avatar-label">Receiving screen…</span>
        </div>
      ) : null}
    </>
  )
}
