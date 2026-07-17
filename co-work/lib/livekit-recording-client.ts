import { supabase } from '~/lib/supabase'

import type { MeetingRecordingStatus } from '~/co-work/lib/meeting-recording-status'

export type MeetingRecordingSummary = {
  id: string
  meetingId: string
  hostId?: string | null
  status: MeetingRecordingStatus | string
  recordingSid?: string | null
  storagePath?: string | null
  durationSeconds?: number | null
  fileSizeBytes?: number | null
  errorMessage?: string | null
  hasShareLink?: boolean
  shareCreatedAt?: string | null
  shareRevokedAt?: string | null
  startedAt?: string | null
  endedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  ready?: boolean
}

export type LiveKitRecordingControlResult = {
  ok: boolean
  recordingId?: string
  recordingSid?: string
  status?: MeetingRecordingStatus | string
  storagePath?: string
  recording?: MeetingRecordingSummary | null
  recordings?: MeetingRecordingSummary[]
  alreadyActive?: boolean
  alreadyStopped?: boolean
  configRequired?: boolean
  warning?: string
  error?: string
}

export type MeetingRecordingShareResult = {
  ok: boolean
  recordingId?: string
  shareUrl?: string
  sharePath?: string
  rotated?: boolean
  revoked?: boolean
  downloadUrl?: string
  playbackUrl?: string
  expiresInSeconds?: number
  status?: string
  durationSeconds?: number | null
  fileSizeBytes?: number | null
  endedAt?: string | null
  createdAt?: string | null
  recordings?: MeetingRecordingSummary[]
  error?: string
}

async function invokeRecordingControl(body: Record<string, unknown>): Promise<LiveKitRecordingControlResult> {
  const { data, error } = await supabase.functions.invoke('livekit-recording', { body })
  if (error) {
    return { ok: false, error: error.message }
  }
  return (data ?? { ok: false, error: 'Recording control failed' }) as LiveKitRecordingControlResult
}

async function invokeRecordingShare(body: Record<string, unknown>): Promise<MeetingRecordingShareResult> {
  const { data, error } = await supabase.functions.invoke('meeting-recording-share', { body })
  if (error) {
    return { ok: false, error: error.message }
  }
  return (data ?? { ok: false, error: 'Recording share failed' }) as MeetingRecordingShareResult
}

export async function startLiveKitCloudRecording(input: {
  meetingId: string
  roomName: string
}): Promise<LiveKitRecordingControlResult> {
  return invokeRecordingControl({
    action: 'start',
    meetingId: input.meetingId,
    roomName: input.roomName,
  })
}

export async function stopLiveKitCloudRecording(input: {
  meetingId: string
  roomName: string
  recordingId?: string
}): Promise<LiveKitRecordingControlResult> {
  return invokeRecordingControl({
    action: 'stop',
    meetingId: input.meetingId,
    roomName: input.roomName,
    recordingId: input.recordingId,
  })
}

export async function fetchMeetingRecordingStatus(input: {
  meetingId: string
  recordingId?: string
  reconcile?: boolean
}): Promise<LiveKitRecordingControlResult> {
  return invokeRecordingControl({
    action: input.reconcile ? 'reconcile' : 'status',
    meetingId: input.meetingId,
    recordingId: input.recordingId,
  })
}

export async function listMeetingRecordings(meetingId: string): Promise<MeetingRecordingShareResult> {
  return invokeRecordingShare({ action: 'list', meetingId })
}

export async function createMeetingRecordingShare(recordingId: string): Promise<MeetingRecordingShareResult> {
  return invokeRecordingShare({ action: 'createShare', recordingId })
}

export async function revokeMeetingRecordingShare(recordingId: string): Promise<MeetingRecordingShareResult> {
  return invokeRecordingShare({ action: 'revokeShare', recordingId })
}

export async function downloadMeetingRecordingUrl(recordingId: string): Promise<MeetingRecordingShareResult> {
  return invokeRecordingShare({ action: 'download', recordingId })
}

export async function resolveMeetingRecordingShare(token: string): Promise<MeetingRecordingShareResult> {
  return invokeRecordingShare({ action: 'resolve', token })
}
