export type MeetingRecordingStatus =
  | 'starting'
  | 'recording'
  | 'processing'
  | 'ready'
  | 'failed'

export const ACTIVE_RECORDING_STATUSES: MeetingRecordingStatus[] = ['starting', 'recording']
export const TERMINAL_RECORDING_STATUSES: MeetingRecordingStatus[] = ['ready', 'failed']

export function isActiveRecordingStatus(status: string | null | undefined): boolean {
  return ACTIVE_RECORDING_STATUSES.includes(status as MeetingRecordingStatus)
}

export function isTerminalRecordingStatus(status: string | null | undefined): boolean {
  return TERMINAL_RECORDING_STATUSES.includes(status as MeetingRecordingStatus)
}

/** Map LiveKit egress status codes / names onto our DB lifecycle. */
export function mapEgressStatusToRecordingStatus(
  egressStatus: string | number | null | undefined,
): MeetingRecordingStatus | null {
  const normalized = String(egressStatus ?? '')
    .trim()
    .toUpperCase()

  if (!normalized) return null

  if (
    normalized === '0' ||
    normalized === 'EGRESS_STARTING' ||
    normalized.includes('STARTING')
  ) {
    return 'starting'
  }
  if (
    normalized === '1' ||
    normalized === 'EGRESS_ACTIVE' ||
    normalized.includes('ACTIVE') ||
    normalized.includes('ENCODING')
  ) {
    return 'recording'
  }
  if (
    normalized === '2' ||
    normalized === 'EGRESS_ENDING' ||
    normalized.includes('ENDING')
  ) {
    return 'processing'
  }
  if (
    normalized === '3' ||
    normalized === 'EGRESS_COMPLETE' ||
    normalized.includes('COMPLETE')
  ) {
    return 'ready'
  }
  if (
    normalized === '4' ||
    normalized === 'EGRESS_FAILED' ||
    normalized === '5' ||
    normalized === 'EGRESS_ABORTED' ||
    normalized === '6' ||
    normalized === 'EGRESS_LIMIT_REACHED' ||
    normalized.includes('FAILED') ||
    normalized.includes('ABORTED') ||
    normalized.includes('LIMIT')
  ) {
    return 'failed'
  }

  return null
}

export async function hashShareToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function createShareToken(bytes = 24): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function buildRecordingSharePath(token: string): string {
  return `/co-work/recording/${encodeURIComponent(token)}`
}

export function recordingStatusLabel(status: MeetingRecordingStatus | string): string {
  switch (status) {
    case 'starting':
      return 'Starting'
    case 'recording':
      return 'Recording'
    case 'processing':
      return 'Processing'
    case 'ready':
      return 'Ready'
    case 'failed':
      return 'Failed'
    default:
      return status
  }
}
