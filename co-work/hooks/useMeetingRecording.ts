import type { Room } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  buildLiveKitRecordingStream,
  downloadCaptionTranscript,
  downloadMeetingRecording,
  getMeetingRecorderMimeType,
  isMeetingRecordingSupported,
} from '~/co-work/lib/meeting-recording'
import { hasMediaRecorder, isNativeRuntime } from '~/lib/platform/capabilities'

type UseMeetingRecordingOptions = {
  room: Room | null | undefined
  meetingCode: string
  enabled: boolean
  autoStart?: boolean
  captionLines?: string[]
  onStarted?: () => void
  onStopped?: () => void
  onError?: (message: string) => void
}

export function useMeetingRecording({
  room,
  meetingCode,
  enabled,
  autoStart = false,
  captionLines = [],
  onStarted,
  onStopped,
  onError,
}: UseMeetingRecordingOptions) {
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const autoStartedRef = useRef(false)
  const nativeRecordingRef = useRef(false)

  const stopWebRecorder = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const stopRecording = useCallback(async () => {
    if (nativeRecordingRef.current) {
      nativeRecordingRef.current = false
      try {
        const { stopNativeAudioRecording } = await import('~/co-work/lib/native-audio-recording')
        await stopNativeAudioRecording(meetingCode)
        if (captionLines.length > 0) {
          await downloadCaptionTranscript(captionLines, meetingCode)
        }
        setRecording(false)
        onStopped?.()
      } catch (error) {
        onError?.(error instanceof Error ? error.message : 'Could not save recording')
        setRecording(false)
      }
      return
    }

    stopWebRecorder()
  }, [captionLines, meetingCode, onError, onStopped, stopWebRecorder])

  const startRecording = useCallback(async () => {
    if (!isMeetingRecordingSupported()) {
      onError?.('Recording is not supported on this device')
      return false
    }

    if (recording) {
      await stopRecording()
      return true
    }

    if (isNativeRuntime() && !hasMediaRecorder()) {
      try {
        const { startNativeAudioRecording } = await import('~/co-work/lib/native-audio-recording')
        await startNativeAudioRecording()
        nativeRecordingRef.current = true
        setRecording(true)
        onStarted?.()
        return true
      } catch (error) {
        onError?.(error instanceof Error ? error.message : 'Could not start recording')
        return false
      }
    }

    if (!room) {
      onError?.('Connect to the meeting before recording')
      return false
    }

    const stream = buildLiveKitRecordingStream(room)
    if (stream.getTracks().length === 0) {
      onError?.('Turn on your camera or mic to record')
      return false
    }

    try {
      const hasVideo = stream.getVideoTracks().length > 0
      const mimeType = getMeetingRecorderMimeType(hasVideo)
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const extension = hasVideo ? 'webm' : 'webm'
        void downloadMeetingRecording(blob, meetingCode, extension)
        if (captionLines.length > 0) {
          void downloadCaptionTranscript(captionLines, meetingCode)
        }
        setRecording(false)
        recorderRef.current = null
        onStopped?.()
      }

      recorder.start(1000)
      recorderRef.current = recorder
      setRecording(true)
      onStarted?.()
      return true
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Could not start recording')
      return false
    }
  }, [captionLines, meetingCode, onError, onStarted, onStopped, recording, room, stopRecording])

  const toggleRecording = useCallback(() => {
    void startRecording()
  }, [startRecording])

  useEffect(() => {
    return () => {
      recorderRef.current?.stop()
      recorderRef.current = null
      if (nativeRecordingRef.current) {
        void import('~/co-work/lib/native-audio-recording').then(({ cancelNativeAudioRecording }) =>
          cancelNativeAudioRecording(),
        )
        nativeRecordingRef.current = false
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled || !autoStart || autoStartedRef.current) return
    if (!room && !isNativeRuntime()) return
    autoStartedRef.current = true
    void startRecording()
  }, [autoStart, enabled, room, startRecording])

  return {
    recording,
    supported: isMeetingRecordingSupported(),
    toggleRecording,
    startRecording,
    stopRecording,
  }
}
