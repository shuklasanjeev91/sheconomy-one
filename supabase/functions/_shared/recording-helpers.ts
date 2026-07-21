export type MeetingRecordingStatus =
  | 'starting'
  | 'recording'
  | 'processing'
  | 'ready'
  | 'failed'

export function mapEgressStatusToRecordingStatus(
  egressStatus: string | number | null | undefined,
): MeetingRecordingStatus | null {
  const normalized = String(egressStatus ?? '')
    .trim()
    .toUpperCase()

  if (!normalized) return null

  if (normalized === '0' || normalized === 'EGRESS_STARTING' || normalized.includes('STARTING')) {
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
  if (normalized === '2' || normalized === 'EGRESS_ENDING' || normalized.includes('ENDING')) {
    return 'processing'
  }
  if (normalized === '3' || normalized === 'EGRESS_COMPLETE' || normalized.includes('COMPLETE')) {
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

export function nanosToSeconds(value: unknown): number | null {
  if (typeof value === 'bigint') {
    return Math.max(0, Math.round(Number(value) / 1_000_000_000))
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value / 1_000_000_000))
  }
  if (typeof value === 'string' && value.trim()) {
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) {
      return Math.max(0, Math.round(asNumber / 1_000_000_000))
    }
  }
  return null
}

export function extractEgressFileInfo(info: Record<string, unknown>): {
  location?: string
  size?: number
  durationSeconds?: number | null
  filename?: string
} {
  const fileResults = Array.isArray(info.fileResults) ? info.fileResults : []
  const firstResult = (fileResults[0] ?? null) as Record<string, unknown> | null
  const result = info.result as { case?: string; value?: Record<string, unknown> } | undefined
  const file =
    firstResult ||
    (result?.case === 'file' || result?.value ? (result.value ?? result) : null) ||
    null

  if (!file || typeof file !== 'object') {
    return {
      durationSeconds: nanosToSeconds(info.endedAt) && nanosToSeconds(info.startedAt)
        ? Math.max(0, (nanosToSeconds(info.endedAt) ?? 0) - (nanosToSeconds(info.startedAt) ?? 0))
        : null,
    }
  }

  const sizeRaw = file.size
  const size =
    typeof sizeRaw === 'bigint'
      ? Number(sizeRaw)
      : typeof sizeRaw === 'number'
        ? sizeRaw
        : typeof sizeRaw === 'string'
          ? Number(sizeRaw)
          : undefined

  return {
    location: typeof file.location === 'string' ? file.location : undefined,
    filename: typeof file.filename === 'string' ? file.filename : undefined,
    size: Number.isFinite(size) ? size : undefined,
    durationSeconds:
      nanosToSeconds(file.duration) ??
      (nanosToSeconds(info.endedAt) != null && nanosToSeconds(info.startedAt) != null
        ? Math.max(0, (nanosToSeconds(info.endedAt) as number) - (nanosToSeconds(info.startedAt) as number))
        : null),
  }
}
