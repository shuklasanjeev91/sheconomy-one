/**
 * LiveKit RemoteVideoTrack often exists before MediaStream attaches.
 * RTCView blanks permanently if mounted with an empty streamURL — only treat
 * the track as renderable once a stream URL can be formed.
 *
 * When mediaStream is missing but mediaStreamTrack exists (common on Android
 * screen-share subscribe), attach a MediaStream so RTCView/VideoTrack can render.
 */
export function ensureNativeVideoMediaStream(
  track:
    | {
        mediaStream?: { id?: string } | null
        mediaStreamTrack?: MediaStreamTrack | null
      }
    | null
    | undefined,
): { id?: string } | null {
  if (!track) return null
  if (track.mediaStream?.id) return track.mediaStream

  const mediaTrack = track.mediaStreamTrack
  if (!mediaTrack) return null

  try {
    // Prefer LiveKit / RN WebRTC MediaStream when available.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webrtc = require('@livekit/react-native-webrtc') as {
      MediaStream?: new (tracks?: MediaStreamTrack[]) => { id?: string; addTrack?: (t: MediaStreamTrack) => void }
    }
    if (typeof webrtc.MediaStream === 'function') {
      const stream = new webrtc.MediaStream([mediaTrack])
      ;(track as { mediaStream?: unknown }).mediaStream = stream
      return stream
    }
  } catch {
    // fall through
  }

  try {
    if (typeof MediaStream !== 'undefined') {
      const stream = new MediaStream([mediaTrack])
      ;(track as { mediaStream?: MediaStream }).mediaStream = stream
      return stream
    }
  } catch {
    // ignore
  }

  return null
}

export function resolveNativeVideoStreamAttachId(
  track:
    | {
        mediaStream?: { id?: string } | null
        mediaStreamTrack?: MediaStreamTrack | null
        sid?: string | null
      }
    | null
    | undefined,
): string | null {
  const ensured = ensureNativeVideoMediaStream(track)
  const streamId = ensured?.id ?? track?.mediaStream?.id
  if (typeof streamId === 'string' && streamId.length > 0) return streamId
  // Last resort: track id — still remounts VideoTrack once a MediaStreamTrack exists.
  const trackId = track?.mediaStreamTrack?.id
  if (typeof trackId === 'string' && trackId.length > 0) {
    ensureNativeVideoMediaStream(track)
    return track?.mediaStream?.id || trackId
  }
  return null
}
