import React from 'react'
import { StyleSheet, View } from 'react-native'
import { VideoTrack, isTrackReference } from '@livekit/react-native'

type Props = {
  trackRef: any
  mirrored?: boolean
}

export function SessionMiniPlayerVideo({ trackRef, mirrored = false }: Props) {
  if (!trackRef || !isTrackReference(trackRef)) return null

  return (
    <View style={styles.container}>
      <VideoTrack
        trackRef={trackRef}
        style={styles.video}
        objectFit="cover"
        mirror={mirrored}
        zOrder={0}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0c080a',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
})
