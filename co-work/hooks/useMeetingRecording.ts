import type { Room } from 'livekit-client'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  fetchMeetingRecordingStatus,
  startLiveKitCloudRecording,
  stopLiveKitCloudRecording,
  type MeetingRecordingSummary,
} from '~/co-work/lib/livekit-recording-client'
import {
  isActiveRecordingStatus,
  isTerminalRecordingStatus,
  type MeetingRecordingStatus,
} from '~/co-work/lib/meeting-recording-status'
import { downloadCaptionTranscript } from '~/co-work/lib/meeting-recording'
import { supabase } from '~/lib/supabase'

type UseMeetingRecordingOptions = {
  room: Room | null | undefined
  meetingId?: string
  meetingCode: string
  enabled: boolean
  autoStart?: boolean
  captionLines?: string[]
  onStarted?: (mode?: 'cloud') => void
  onStopped?: (status?: MeetingRecordingStatus | string) => void
  onReady?: (recording: MeetingRecordingSummary) => void
  onError?: (message: string, configRequired?: boolean) => void
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
  onReady,
  onError,
}: UseMeetingRecordingOptions) {
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState<MeetingRecordingStatus | string | null>(null)
  const [activeRecording, setActiveRecording] = useState<MeetingRecordingSummary | null>(null)
  const [recordings, setRecordings] = useState<MeetingRecordingSummary[]>([])
  const cloudRecordingIdRef = useRef<string | null>(null)
  const startingRef = useRef(false)
  const autoStartedRef = useRef(false)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const readyNotifiedRef = useRef<string | null>(null)

  // Screens pass inline arrows for these callbacks; keep them in refs so
  // refreshStatus stays referentially stable and effects don't re-fire (and
  // spam the edge function) on every render.
  const onStartedRef = useRef(onStarted)
  onStartedRef.current = onStarted
  const onStoppedRef = useRef(onStopped)
  onStoppedRef.current = onStopped
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const applyRecordingState = useCallback((rows: MeetingRecordingSummary[]) => {
    setRecordings(rows)
    const active =
      rows.find((row) => isActiveRecordingStatus(row.status)) ??
      rows.find((row) => row.status === 'processing') ??
      rows[0] ??
      null
    setActiveRecording(active)
    setStatus(active?.status ?? null)
    setRecording(!!active && isActiveRecordingStatus(active.status))
    if (active && isActiveRecordingStatus(active.status)) {
      cloudRecordingIdRef.current = active.id
    } else if (active?.status === 'processing') {
      cloudRecordingIdRef.current = active.id
    }
  }, [])

  const refreshStatus = useCallback(
    async (reconcile = false) => {
      if (!meetingId || !enabled) return null
      const result = await fetchMeetingRecordingStatus({
        meetingId,
        recordingId: cloudRecordingIdRef.current ?? undefined,
        reconcile,
      })
      if (!result.ok) {
        // Status polling errors are transient — never toast them at the user.
        return result
      }
      const rows = result.recordings ?? (result.recording ? [result.recording] : [])
      applyRecordingState(rows)
      const ready = rows.find((row) => row.status === 'ready')
      if (ready && readyNotifiedRef.current !== ready.id) {
        readyNotifiedRef.current = ready.id
        onReadyRef.current?.(ready)
      }
      return result
    },
    [applyRecordingState, enabled, meetingId],
  )

  const stopRecording = useCallback(async () => {
    if (!meetingId || !room?.name) {
      onErrorRef.current?.('Connect to the meeting before stopping recording')
      return false
    }

    const result = await stopLiveKitCloudRecording({
      meetingId,
      roomName: room.name,
      recordingId: cloudRecordingIdRef.current ?? undefined,
    })

    if (!result.ok) {
      onErrorRef.current?.(result.error || 'Could not stop cloud recording')
      return false
    }

    setRecording(false)
    setStatus(result.status ?? 'processing')
    if (captionLines.length > 0) {
      void downloadCaptionTranscript(captionLines, meetingCode)
    }
    onStoppedRef.current?.(result.status ?? 'processing')
    void refreshStatus(true)
    return true
  }, [captionLines, meetingCode, meetingId, refreshStatus, room?.name])

  const startRecording = useCallback(async () => {
    if (startingRef.current) return false
    startingRef.current = true

    try {
      if (!enabled) {
        onErrorRef.current?.('Recording is disabled for this meeting')
        return false
      }
      if (!meetingId || !room?.name) {
        onErrorRef.current?.('Connect to the meeting before recording')
        return false
      }

      if (recording || isActiveRecordingStatus(status)) {
        return stopRecording()
      }

      const cloud = await startLiveKitCloudRecording({
        meetingId,
        roomName: room.name,
      })

      if (!cloud.ok || !cloud.recordingId) {
        // Surface configRequired so the caller can show a targeted setup alert
        // instead of a raw technical error message.
        if (cloud.configRequired) {
          onErrorRef.current?.(
            'Recording storage is not set up. Ask your app administrator to configure Supabase Storage S3 access keys.',
            true,
          )
        } else {
          onErrorRef.current?.(cloud.error || 'Could not start cloud recording')
        }
        return false
      }

      cloudRecordingIdRef.current = cloud.recordingId
      setRecording(true)
      setStatus(cloud.status ?? 'recording')
      setActiveRecording({
        id: cloud.recordingId,
        meetingId,
        status: cloud.status ?? 'recording',
        recordingSid: cloud.recordingSid,
        storagePath: cloud.storagePath,
      })
      onStartedRef.current?.('cloud')
      void refreshStatus(false)
      return true
    } finally {
      startingRef.current = false
    }
  }, [enabled, meetingId, recording, refreshStatus, room?.name, status, stopRecording])

  const toggleRecording = useCallback(() => {
    void startRecording()
  }, [startRecording])

  useEffect(() => {
    if (!enabled || !meetingId) return
    void refreshStatus(true)
  }, [enabled, meetingId, refreshStatus])

  useEffect(() => {
    if (!enabled || !meetingId) return

    const channel = supabase
      .channel(`meeting-recordings:${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_recordings',
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => {
          void refreshStatus(false)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, meetingId, refreshStatus])

  useEffect(() => {
    const needsPoll =
      enabled &&
      !!meetingId &&
      !!status &&
      (isActiveRecordingStatus(status) || status === 'processing')

    clearPoll()
    if (!needsPoll) return

    pollTimerRef.current = setInterval(() => {
      void refreshStatus(true)
    }, 8000)

    return clearPoll
  }, [clearPoll, enabled, meetingId, refreshStatus, status])

  useEffect(() => {
    if (!enabled || !autoStart || autoStartedRef.current) return
    if (!room?.name || !meetingId) return
    autoStartedRef.current = true
    void startRecording()
  }, [autoStart, enabled, meetingId, room?.name, startRecording])

  useEffect(() => {
    return () => clearPoll()
  }, [clearPoll])

  return {
    recording,
    status,
    activeRecording,
    recordings,
    supported: true,
    isProcessing: status === 'processing',
    isReady: status === 'ready' || recordings.some((row) => row.status === 'ready'),
    isFailed: status === 'failed',
    toggleRecording,
    startRecording,
    stopRecording,
    refreshStatus,
  }
}

export function useMeetingRecordingIndicator(meetingId: string | undefined, enabled = true) {
  const [isRecording, setIsRecording] = useState(false)

  useEffect(() => {
    if (!meetingId || !enabled) {
      setIsRecording(false)
      return
    }

    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('meeting_recordings')
        .select('id, status')
        .eq('meeting_id', meetingId)
        .in('status', ['starting', 'recording'])
        .limit(1)
      if (!cancelled) setIsRecording((data?.length ?? 0) > 0)
    }

    void load()

    const channel = supabase
      .channel(`meeting-recording-indicator:${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_recordings',
          filter: `meeting_id=eq.${meetingId}`,
        },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [enabled, meetingId])

  return { isRecording }
}

export function useStopRecordingOnEnd(
  stopRecording: () => Promise<boolean>,
  recording: boolean,
  status: string | null,
) {
  return useCallback(async () => {
    if (recording || isActiveRecordingStatus(status)) {
      await stopRecording()
      return
    }
    if (status && !isTerminalRecordingStatus(status) && status === 'processing') {
      // Already stopping/processing — nothing to do.
    }
  }, [recording, status, stopRecording])
}
