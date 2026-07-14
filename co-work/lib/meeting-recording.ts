import type { Room } from 'livekit-client'

import { hasMediaRecorder } from '~/lib/platform/capabilities'
import { shareBlob } from '~/lib/platform/shareBlob'

import { isNativeAudioRecordingSupported } from './native-audio-recording'

export function isMeetingRecordingSupported() {
  return hasMediaRecorder() || isNativeAudioRecordingSupported()
}

function addParticipantTracks(
  stream: MediaStream,
  seen: Set<string>,
  participant: { trackPublications: Iterable<{ track?: { mediaStreamTrack?: MediaStreamTrack | null } | null }> },
) {
  for (const publication of participant.trackPublications) {
    const track = publication.track?.mediaStreamTrack
    if (!track || seen.has(track.id)) continue
    seen.add(track.id)
    stream.addTrack(track)
  }
}

/** Combine local + remote LiveKit tracks into one recordable stream. */
export function buildLiveKitRecordingStream(room: Room): MediaStream {
  const stream = new MediaStream()
  const seen = new Set<string>()

  addParticipantTracks(stream, seen, room.localParticipant)
  room.remoteParticipants.forEach((participant) => addParticipantTracks(stream, seen, participant))

  return stream
}

export function getMeetingRecorderMimeType(hasVideo: boolean): string {
  const isTypeSupported =
    typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
      ? (type: string) => MediaRecorder.isTypeSupported(type)
      : () => false

  if (!hasVideo) {
    const audioTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    for (const type of audioTypes) {
      if (isTypeSupported(type)) return type
    }
    return 'audio/webm'
  }

  const videoTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  for (const type of videoTypes) {
    if (isTypeSupported(type)) return type
  }
  return 'video/webm'
}

export async function downloadMeetingRecording(blob: Blob, meetingCode: string, extension: string) {
  const filename = `sheconomy-${meetingCode}-${Date.now()}.${extension}`
  await shareBlob(blob, filename, blob.type || undefined)
}

export async function downloadCaptionTranscript(lines: string[], meetingCode: string) {
  const body = lines.length > 0 ? lines.join('\n') : 'No captions captured during this recording.'
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
  await downloadMeetingRecording(blob, meetingCode, 'captions.txt')
}
