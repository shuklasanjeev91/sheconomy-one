import AsyncStorage from '@react-native-async-storage/async-storage'

import type { LiveCaptionLine } from '~/co-work/lib/live-captions'

export type MeetingTranscriptArchiveEntry = {
  meetingId: string
  savedAt: string
  lines: Array<{
    speaker: string
    text: string
    timestamp: number
    isFinal: boolean
  }>
}

const archiveKey = (meetingId: string) => `sheconomy:meeting-transcript:${meetingId}`

export function buildMeetingTranscriptArchive(
  meetingId: string,
  lines: LiveCaptionLine[],
): MeetingTranscriptArchiveEntry {
  return {
    meetingId,
    savedAt: new Date().toISOString(),
    lines: lines
      .filter((line) => line.isFinal && line.text.trim())
      .map((line) => ({
        speaker: line.speaker || 'Speaker',
        text: line.originalText || line.text,
        timestamp: line.timestamp,
        isFinal: true,
      })),
  }
}

export async function saveMeetingTranscriptArchive(
  entry: MeetingTranscriptArchiveEntry,
): Promise<void> {
  if (!entry.meetingId) return
  await AsyncStorage.setItem(archiveKey(entry.meetingId), JSON.stringify(entry))
}

export async function loadMeetingTranscriptArchive(
  meetingId: string,
): Promise<MeetingTranscriptArchiveEntry | null> {
  if (!meetingId) return null
  try {
    const raw = await AsyncStorage.getItem(archiveKey(meetingId))
    if (!raw) return null
    return JSON.parse(raw) as MeetingTranscriptArchiveEntry
  } catch {
    return null
  }
}

export function transcriptArchiveToPlainText(entry: MeetingTranscriptArchiveEntry): string {
  return entry.lines
    .map((line) => {
      const when = new Date(line.timestamp).toLocaleTimeString()
      return `[${when}] ${line.speaker}: ${line.text}`
    })
    .join('\n')
}

/** Copy / download helpers for Zoom-style transcript export. */
export async function copyMeetingTranscriptText(text: string): Promise<boolean> {
  const value = text.trim()
  if (!value) return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // fall through
  }
  return false
}

export function downloadMeetingTranscriptText(input: {
  meetingId: string
  text: string
  filename?: string
}): boolean {
  const text = input.text.trim()
  if (!text || typeof document === 'undefined') return false
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = input.filename || `meeting-${input.meetingId}-transcript.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    return true
  } catch {
    return false
  }
}
