import React from 'react'
import { VideoTrack, isTrackReference } from '@livekit/components-react'

type Props = {
  trackRef: any
  mirrored?: boolean
}

export function SessionMiniPlayerVideo({ trackRef, mirrored = false }: Props) {
  if (!trackRef || !isTrackReference(trackRef)) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0c080a',
        overflow: 'hidden',
      }}
    >
      <VideoTrack
        trackRef={trackRef}
        manageSubscription={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: mirrored ? 'scaleX(-1)' : undefined,
        }}
      />
    </div>
  )
}
