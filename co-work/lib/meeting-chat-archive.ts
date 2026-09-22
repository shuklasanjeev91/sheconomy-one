import type { MeetingChatMessage } from '~/co-work/lib/types'
import { isMeetingSystemChatMessage } from '~/co-work/lib/meeting-chat'
import { safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'

export type MeetingChatArchiveEntry = {
  meetingId: string
  savedAt: string
  lines: Array<{
    speaker: string
    text: string
    timestamp: number
    audience: string
  }>
}

export function buildMeetingChatArchive(
  meetingId: string,
  messages: MeetingChatMessage[],
  displayNames: Record<string, string> = {},
): MeetingChatArchiveEntry {
  return {
    meetingId,
    savedAt: new Date().toISOString(),
    lines: messages
      .filter((row) => {
        const text = String(row.message_text || '').trim()
        if (!text) return false
        // Keep system lines (join/leave) in the archive — Zoom saves them too.
        return true
      })
      .map((row) => {
        const system = isMeetingSystemChatMessage(row)
        const speaker = system
          ? 'System'
          : safeMeetingDisplayName(
              displayNames[row.sender_id] ||
                row.sender?.full_name ||
                row.sender?.username ||
                'Participant',
            )
        return {
          speaker,
          text: String(row.message_text || '').trim(),
          timestamp: row.created_at ? Date.parse(row.created_at) || Date.now() : Date.now(),
          audience: row.audience || row.message_type || 'everyone',
        }
      }),
  }
}

export function chatArchiveToPlainText(entry: MeetingChatArchiveEntry): string {
  return entry.lines
    .map((line) => {
      const when = new Date(line.timestamp).toLocaleTimeString()
      const audience =
        line.audience && line.audience !== 'everyone' && line.audience !== 'system'
          ? ` (${line.audience})`
          : ''
      return `[${when}] ${line.speaker}${audience}: ${line.text}`
    })
    .join('\n')
}

export async function copyMeetingChatText(text: string): Promise<boolean> {
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

export function downloadMeetingChatText(input: {
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
    anchor.download = input.filename || `meeting-${input.meetingId}-chat.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    return true
  } catch {
    return false
  }
}
