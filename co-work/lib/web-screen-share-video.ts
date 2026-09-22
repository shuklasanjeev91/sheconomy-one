/** True once an HTML video element has decoded at least one real frame. */
export function screenShareVideoHasFrames(video: {
  videoWidth?: number
  videoHeight?: number
} | null | undefined): boolean {
  return (Number(video?.videoWidth) || 0) > 1 && (Number(video?.videoHeight) || 0) > 1
}

export function screenShareStreamForTrack(input: {
  mediaStream?: MediaStream | { id?: string } | null
  mediaStreamTrack?: MediaStreamTrack | null
}): MediaStream | null {
  if (typeof MediaStream !== 'undefined' && input.mediaStream instanceof MediaStream) {
    return input.mediaStream
  }
  const mediaTrack = input.mediaStreamTrack
  if (!mediaTrack || typeof MediaStream === 'undefined') return null
  try {
    return new MediaStream([mediaTrack])
  } catch {
    return null
  }
}
