import { useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { MediaStream, RTCView } from 'react-native-webrtc'

type Props = {
  track: MediaStreamTrack
  mirrored?: boolean
  /** Draw above every other video surface (Android PiP window covers the live room). */
  onTop?: boolean
}

export function SessionMiniPlayerVideo({ track, mirrored = false, onTop = false }: Props) {
  const stream = useMemo(() => new MediaStream([track as never]), [track])
  useEffect(() => () => stream.release(false), [stream])

  return (
    <View style={styles.container}>
      <RTCView
        streamURL={stream.toURL()}
        style={styles.video}
        objectFit="cover"
        mirror={mirrored}
        zOrder={onTop ? 2 : 0}
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
