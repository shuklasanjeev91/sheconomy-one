/**
 * LiveKit RemoteVideoTrack often exists before MediaStream attaches.
 * RTCView blanks permanently if mounted with an empty streamURL — only treat
 * the track as renderable once mediaStream.id is present.
 */
export function resolveNativeVideoStreamAttachId(
  track:
    | {
        mediaStream?: { id?: string } | null
        sid?: string | null
      }
    | null
    | undefined,
): string | null {
  const streamId = track?.mediaStream?.id
  if (typeof streamId === 'string' && streamId.length > 0) return streamId
  return null
}
