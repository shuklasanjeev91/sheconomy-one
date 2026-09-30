import { useEffect, useRef } from 'react'

type Props = {
  track: MediaStreamTrack
  mirrored?: boolean
  onTop?: boolean
}

export function SessionMiniPlayerVideo({ track, mirrored = false }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.srcObject = new MediaStream([track])
    void node.play().catch(() => {})
    return () => {
      node.srcObject = null
    }
  }, [track])

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
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
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
