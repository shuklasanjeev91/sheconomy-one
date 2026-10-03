import { describe, expect, it } from 'vitest'

import {
  formatMeetingChatAttachmentSize,
  isSignedMeetingChatAttachmentUrl,
  meetingChatAttachmentCaption,
  meetingChatAttachmentMetadata,
  parseMeetingChatAttachmentMetadata,
  sanitizeRemoteMeetingChatMessage,
} from '~/co-work/lib/meeting-chat-attachments'
import type { MeetingChatMessage } from '~/co-work/lib/types'

const ORIGIN = 'https://proj.supabase.co'
const MEETING = 'm-1'
const SENDER = 'u-1'
const PATH = `meetings/${MEETING}/${SENDER}/1700000000000-abc123-report.pdf`
const SIGNED = `${ORIGIN}/storage/v1/object/sign/chat-files/${PATH}?token=t`

function message(partial: Partial<MeetingChatMessage> = {}): MeetingChatMessage {
  return {
    id: 'msg-1',
    meeting_id: MEETING,
    sender_id: SENDER,
    message_text: 'report.pdf',
    message_type: 'text',
    created_at: null,
    audience: 'everyone',
    attachment: {
      path: PATH,
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      kind: 'pdf',
      size: 2048,
      url: SIGNED,
    },
    ...partial,
  }
}

describe('parseMeetingChatAttachmentMetadata', () => {
  it('round-trips what a new chat row stores', () => {
    const metadata = meetingChatAttachmentMetadata({
      path: PATH,
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      kind: 'pdf',
      size: 2048,
    })
    expect(parseMeetingChatAttachmentMetadata(metadata, MEETING, SENDER)).toEqual(metadata.attachment)
  })

  it("rejects files outside the sender's folder for this meeting", () => {
    const other = { attachment: { path: `meetings/${MEETING}/someone-else/x.pdf`, fileName: 'x.pdf' } }
    const otherMeeting = { attachment: { path: `meetings/m-2/${SENDER}/x.pdf`, fileName: 'x.pdf' } }
    const traversal = { attachment: { path: `meetings/${MEETING}/${SENDER}/../../m-2/x.pdf` } }
    expect(parseMeetingChatAttachmentMetadata(other, MEETING, SENDER)).toBeNull()
    expect(parseMeetingChatAttachmentMetadata(otherMeeting, MEETING, SENDER)).toBeNull()
    expect(parseMeetingChatAttachmentMetadata(traversal, MEETING, SENDER)).toBeNull()
    expect(parseMeetingChatAttachmentMetadata(null, MEETING, SENDER)).toBeNull()
  })

  it('fills in mime type and kind from the file name', () => {
    const parsed = parseMeetingChatAttachmentMetadata(
      { attachment: { path: `meetings/${MEETING}/${SENDER}/a-photo.jpg`, fileName: 'photo.jpg' } },
      MEETING,
      SENDER,
    )
    expect(parsed).toMatchObject({ mimeType: 'image/jpeg', kind: 'image', size: null })
  })
})

describe('sanitizeRemoteMeetingChatMessage', () => {
  it('keeps a valid signed attachment', () => {
    expect(sanitizeRemoteMeetingChatMessage(message(), ORIGIN).attachment?.url).toBe(SIGNED)
  })

  it('drops URLs that are not the signed URL for that file', () => {
    const phishing = message({ attachment: { ...message().attachment!, url: 'https://evil.example/x' } })
    const swapped = message({
      attachment: {
        ...message().attachment!,
        url: `${ORIGIN}/storage/v1/object/sign/chat-files/meetings/${MEETING}/${SENDER}/other.pdf?token=t`,
      },
    })
    expect(sanitizeRemoteMeetingChatMessage(phishing, ORIGIN).attachment?.url).toBeNull()
    expect(sanitizeRemoteMeetingChatMessage(swapped, ORIGIN).attachment?.url).toBeNull()
  })

  it('removes attachments pointing outside the meeting', () => {
    const outside = message({ attachment: { ...message().attachment!, path: 'avatars/u-1/me.png' } })
    expect(sanitizeRemoteMeetingChatMessage(outside, ORIGIN).attachment).toBeNull()
  })

  it('leaves plain text messages alone', () => {
    const text = message({ attachment: undefined, message_text: 'hi' })
    expect(sanitizeRemoteMeetingChatMessage(text, ORIGIN)).toBe(text)
  })
})

describe('isSignedMeetingChatAttachmentUrl', () => {
  it('requires an https storage origin', () => {
    expect(isSignedMeetingChatAttachmentUrl(SIGNED, PATH, ORIGIN)).toBe(true)
    expect(isSignedMeetingChatAttachmentUrl(SIGNED, PATH, 'http://proj.supabase.co')).toBe(false)
  })
})

describe('meetingChatAttachmentCaption', () => {
  it('hides a caption that only repeats the file name', () => {
    expect(meetingChatAttachmentCaption(message())).toBeNull()
    expect(meetingChatAttachmentCaption(message({ message_text: 'Agenda for today' }))).toBe('Agenda for today')
    expect(meetingChatAttachmentCaption(message({ attachment: null, message_text: 'hello' }))).toBe('hello')
  })
})

describe('formatMeetingChatAttachmentSize', () => {
  it('formats bytes for the file card', () => {
    expect(formatMeetingChatAttachmentSize(512)).toBe('512 B')
    expect(formatMeetingChatAttachmentSize(2048)).toBe('2 KB')
    expect(formatMeetingChatAttachmentSize(3.5 * 1024 * 1024)).toBe('3.5 MB')
    expect(formatMeetingChatAttachmentSize(42 * 1024 * 1024)).toBe('42 MB')
    expect(formatMeetingChatAttachmentSize(null)).toBeNull()
  })
})
