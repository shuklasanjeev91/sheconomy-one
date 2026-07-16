import type { Room } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  startLiveKitCloudRecording,
  stopLiveKitCloudRecording,
} from '~/co-work/lib/livekit-recording-client'
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
  meetingId?: string
  meetingCode: string
  enabled: boolean
  autoStart?: boolean
  captionLines?: string[]
  onStarted?: (mode?: 'cloud' | 'local' | 'audio-only') => void
  onStopped?: () => void
  onError?: (message: string) => void
}

function shouldPreferNativeLocalAudio() {
  return isNativeRuntime()
}

export function useMeetingRecording({
  room,
  meetingId,
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
  const cloudRecordingIdRef = useRef<string | null>(null)
  const startingRef = useRef(false)

  const stopWebRecorder = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const stopRecording = useCallback(async () => {
    if (cloudRecordingIdRef.current && meetingId && room?.name) {
      const recordingId = cloudRecordingIdRef.current
      cloudRecordingIdRef.current = null
      try {
        await stopLiveKitCloudRecording({
          meetingId,
          roomName: room.name,
          recordingId,
        })
        if (captionLines.length > 0) {
          await downloadCaptionTranscript(captionLines, meetingCode)
        }
        setRecording(false)
        onStopped?.()
      } catch (error) {
        onError?.(error instanceof Error ? error.message : 'Could not stop cloud recording')
        setRecording(false)
      }
      return
    }

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
  }, [captionLines, meetingCode, meetingId, onError, onStopped, room?.name, stopWebRecorder])

  const startLocalNativeAudio = useCallback(async () => {
    const { startNativeAudioRecording } = await import('~/co-work/lib/native-audio-recording')
    await startNativeAudioRecording()
    nativeRecordingRef.current = true
    setRecording(true)
    onStarted?.('audio-only')
    return true
  }, [onStarted])

  const startWebLocalRecorder = useCallback(async () => {
    if (!hasMediaRecorder()) {
      onError?.('Recording is not supported in this browser')
      return false
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

    const hasVideo = stream.getVideoTracks().length > 0
    const mimeType = getMeetingRecorderMimeType(hasVideo)
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    chunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
      void downloadMeetingRecording(blob, meetingCode, 'webm')
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
    onStarted?.('local')
    return true
  }, [captionLines, meetingCode, onError, onStarted, onStopped, room])

  const startRecording = useCallback(async () => {
    if (startingRef.current) return false
    startingRef.current = true

    try {
      if (!isMeetingRecordingSupported()) {
        onError?.('Recording is not supported on this device')
        return false
      }

      if (recording) {
        await stopRecording()
        return true
      }

      // Prefer cloud egress on all platforms when meeting + room are known.
      if (meetingId && room?.name) {
        const cloud = await startLiveKitCloudRecording({
          meetingId,
          roomName: room.name,
        })
        if (cloud.ok && cloud.recordingId && !cloud.useLocalFallback) {
          cloudRecordingIdRef.current = cloud.recordingId
          setRecording(true)
          onStarted?.('cloud')
          return true
        }
      }

      if (shouldPreferNativeLocalAudio()) {
        try {
          return await startLocalNativeAudio()
        } catch (error) {
          onError?.(error instanceof Error ? error.message : 'Could not start recording')
          return false
        }
      }

      try {
        return await startWebLocalRecorder()
      } catch (error) {
        onError?.(error instanceof Error ? error.message : 'Could not start recording')
        return false
      }
    } finally {
      startingRef.current = false
    }
  }, [
    meetingId,
    onError,
    onStarted,
    recording,
    room?.name,
    startLocalNativeAudio,
    startWebLocalRecorder,
    stopRecording,
  ])

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
      cloudRecordingIdRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled || !autoStart || autoStartedRef.current) return
    if (!room && !shouldPreferNativeLocalAudio()) return
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
