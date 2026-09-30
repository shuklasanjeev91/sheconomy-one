import { describe, expect, it } from 'vitest'

import {
  applyMeetingContentEvent,
  detectMeetingContentKind,
  emptyMeetingContentState,
  isMeetingContentShare,
  MEETING_CONTENT_PAUSED_DRIFT_SEC,
  meetingContentIsStale,
  meetingContentMimeType,
  meetingContentNeedsSeek,
  meetingContentStoragePath,
  meetingContentTitle,
  meetingContentVideoPosition,
  meetingContentViewer,
  trimToPayloadBudget,
  type MeetingContentShare,
} from '~/co-work/lib/meeting-content-share'

const ORIGIN = 'https://proj.supabase.co'
const FILE_URL = `${ORIGIN}/storage/v1/object/sign/chat-files/meetings/m1/u1/deck.pdf?token=abc`

function share(overrides: Partial<MeetingContentShare> = {}): MeetingContentShare {
  return {
    id: 's1',
    from: 'u1',
    presenterName: 'Asha',
    items: [{ url: FILE_URL, fileName: 'deck.pdf', mimeType: 'application/pdf', kind: 'pdf' }],
    index: 0,
    page: 1,
    playing: false,
    positionSec: 0,
    startedAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  }
}

describe('meeting content share', () => {
  it('detects kinds from MIME type or extension', () => {
    expect(detectMeetingContentKind('application/pdf', 'x')).toBe('pdf')
    expect(detectMeetingContentKind('application/octet-stream', 'Deck.PPTX')).toBe('office')
    expect(detectMeetingContentKind('', 'report.docx')).toBe('office')
    expect(detectMeetingContentKind('image/heic', 'a.heic')).toBe('image')
    expect(detectMeetingContentKind('video/quicktime', 'clip.mov')).toBe('video')
    expect(detectMeetingContentKind('audio/mpeg', 'song.mp3')).toBe('audio')
    expect(detectMeetingContentKind('text/csv', 'data.csv')).toBe('text')
    expect(detectMeetingContentKind('application/zip', 'bundle.zip')).toBe('file')
  })

  it('fills in a real content type when pickers report octet-stream', () => {
    expect(meetingContentMimeType('application/octet-stream', 'a.pdf')).toBe('application/pdf')
    expect(meetingContentMimeType(null, 'b.docx')).toContain('wordprocessingml')
    expect(meetingContentMimeType('video/mp4', 'c.bin')).toBe('video/mp4')
    expect(meetingContentMimeType('', 'unknown.xyz')).toBe('application/octet-stream')
  })

  it('picks a viewer per platform', () => {
    const pdf = share().items[0]!
    expect(meetingContentViewer(pdf, 'web', 3)).toEqual({ mode: 'frame', url: `${FILE_URL}#page=3` })
    expect(meetingContentViewer(pdf, 'ios')).toEqual({ mode: 'frame', url: FILE_URL })
    expect(meetingContentViewer(pdf, 'android').url).toMatch(/^https:\/\/docs\.google\.com\/gview\?embedded=1&url=/)
    expect(meetingContentViewer(pdf, 'web-mobile').url).toContain('docs.google.com/gview')
    const office = { ...pdf, kind: 'office' as const }
    expect(meetingContentViewer(office, 'web').url).toContain('view.officeapps.live.com/op/embed.aspx?src=')
    expect(meetingContentViewer({ ...pdf, kind: 'video' }, 'android')).toEqual({ mode: 'video', url: FILE_URL })
    expect(meetingContentViewer({ ...pdf, kind: 'image' }, 'ios')).toEqual({ mode: 'image', url: FILE_URL })
  })

  it('projects the presenter video position from when the update arrived', () => {
    expect(meetingContentVideoPosition({ playing: false, positionSec: 12 }, 1_000, 9_000)).toBe(12)
    expect(meetingContentVideoPosition({ playing: true, positionSec: 12 }, 1_000, 4_000)).toBe(15)
    expect(meetingContentNeedsSeek(10, 11)).toBe(false)
    expect(meetingContentNeedsSeek(10, 12)).toBe(true)
    expect(meetingContentNeedsSeek(11, 12, MEETING_CONTENT_PAUSED_DRIFT_SEC)).toBe(true)
    expect(meetingContentNeedsSeek(12.1, 12, MEETING_CONTENT_PAUSED_DRIFT_SEC)).toBe(false)
  })

  it('lets a newer presenter take over and ignores late updates of the old share', () => {
    const first = applyMeetingContentEvent(emptyMeetingContentState(), {
      type: 'share',
      share: share(),
      receivedAt: 5,
    })
    const takeover = applyMeetingContentEvent(first, {
      type: 'share',
      share: share({ id: 's2', from: 'u2', startedAt: 2_000, updatedAt: 2_000 }),
      receivedAt: 6,
    })
    expect(takeover.share?.id).toBe('s2')
    // Old presenter's heartbeat still in flight after the takeover.
    const lateHeartbeat = applyMeetingContentEvent(takeover, {
      type: 'share',
      share: share({ updatedAt: 3_000 }),
      receivedAt: 7,
    })
    expect(lateHeartbeat.share?.id).toBe('s2')
    // Stop for a share that is no longer on stage changes nothing.
    expect(applyMeetingContentEvent(takeover, { type: 'stop', id: 's1' }).share?.id).toBe('s2')
    expect(applyMeetingContentEvent(takeover, { type: 'stop', id: 's2' }).share).toBeNull()
  })

  it('drops out-of-order updates of the same share', () => {
    const current = { share: share({ page: 4, updatedAt: 5_000 }), receivedAt: 1 }
    const stale = applyMeetingContentEvent(current, { type: 'share', share: share({ page: 2, updatedAt: 4_000 }), receivedAt: 2 })
    expect(stale.share?.page).toBe(4)
  })

  it('only accepts files from this project’s storage', () => {
    expect(isMeetingContentShare(share(), ORIGIN)).toBe(true)
    expect(
      isMeetingContentShare(
        share({ items: [{ url: 'https://evil.example/x.pdf', fileName: 'x', mimeType: '', kind: 'pdf' }] }),
        ORIGIN,
      ),
    ).toBe(false)
    expect(
      isMeetingContentShare(
        share({ items: [{ url: `${ORIGIN}.evil.example/storage/v1/object/x`, fileName: 'x', mimeType: '', kind: 'pdf' }] }),
        ORIGIN,
      ),
    ).toBe(false)
    expect(isMeetingContentShare({ ...share(), items: [] }, ORIGIN)).toBe(false)
    expect(isMeetingContentShare(null, ORIGIN)).toBe(false)
  })

  it('expires a share whose presenter went quiet', () => {
    expect(meetingContentIsStale(0, 10_000)).toBe(false)
    expect(meetingContentIsStale(0, 40_000)).toBe(true)
  })

  it('titles slideshows with position', () => {
    const photos = share({
      index: 1,
      items: [
        { url: FILE_URL, fileName: 'a.jpg', mimeType: 'image/jpeg', kind: 'image' },
        { url: FILE_URL, fileName: 'b.jpg', mimeType: 'image/jpeg', kind: 'image' },
      ],
    })
    expect(meetingContentTitle(photos)).toBe('b.jpg (2 of 2)')
    expect(meetingContentTitle(share())).toBe('deck.pdf')
  })

  it('builds safe storage paths', () => {
    const path = meetingContentStoragePath('m1', 'u1', 'Q3 Report (final)!.PDF', 42)
    expect(path).toMatch(/^meetings\/m1\/u1\/42-[a-z0-9]+-Q3-Report-final\.pdf$/)
  })

  it('keeps the newest rows within a payload budget', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i, pad: 'x'.repeat(90) }))
    const kept = trimToPayloadBudget(rows, 350)
    expect(kept.length).toBe(3)
    expect(kept.map((row) => row.id)).toEqual([7, 8, 9])
  })
})
