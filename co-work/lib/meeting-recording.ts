import type { Room } from 'livekit-client'

import { hasMediaRecorder } from '~/lib/platform/capabilities'
import { shareBlob } from '~/lib/platform/shareBlob'

import { isNativeAudioRecordingSupported } from './native-audio-recording'

/**
 * Local/device recording helpers remain for development fallbacks only.
 * Production Co-Work meetings use LiveKit RoomComposite cloud egress instead.
 */
export function isMeetingRecordingSupported() {
  return hasMediaRecorder() || isNativeAudioRecordingSupported()
}

function addParticipantTracks(
  stream: MediaStream,
  seen: Set<string>,
  participant: {
    trackPublications: Map<string, { track?: { mediaStreamTrack?: MediaStreamTrack | null } | null }>
  },
) {
  // trackPublications is a Map — iterate values(), not the Map itself
  // (which yields [sid, publication] pairs and silently adds no tracks).
  for (const publication of participant.trackPublications.values()) {
    const track = publication.track?.mediaStreamTrack
    if (!track || seen.has(track.id)) continue
    seen.add(track.id)
    stream.addTrack(track)
  }
}

export type RecordingStreamBundle = {
  stream: MediaStream
  /** Release the audio mixer once recording stops. */
  cleanup: () => void
}

/**
 * Combine local + remote LiveKit tracks into one recordable stream.
 * MediaRecorder only records the first audio track of a stream, so all voices
 * (host + participants) are mixed into a single track via WebAudio.
 */
export function buildLiveKitRecordingStream(room: Room): RecordingStreamBundle {
  const raw = new MediaStream()
  const seen = new Set<string>()

  addParticipantTracks(raw, seen, room.localParticipant)
  room.remoteParticipants.forEach((participant) => addParticipantTracks(raw, seen, participant))

  const audioTracks = raw.getAudioTracks()
  const videoTracks = raw.getVideoTracks()

  let mixedAudio = audioTracks
  let cleanup = () => {}

  if (audioTracks.length > 1 && typeof AudioContext !== 'undefined') {
    try {
      const context = new AudioContext()
      const destination = context.createMediaStreamDestination()
      const sources = audioTracks.map((track) => {
        const source = context.createMediaStreamSource(new MediaStream([track]))
        source.connect(destination)
        return source
      })
      mixedAudio = destination.stream.getAudioTracks()
      cleanup = () => {
        for (const source of sources) source.disconnect()
        void context.close()
      }
    } catch {
      // WebAudio unavailable — fall back to raw tracks (first voice only).
      mixedAudio = audioTracks
    }
  }

  return { stream: new MediaStream([...mixedAudio, ...videoTracks]), cleanup }
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
