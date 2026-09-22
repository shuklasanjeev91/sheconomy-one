/**
 * Zoom-style share content kinds shown above share options (screen / photos / files / whiteboard).
 */

export type MeetingShareContentKind = 'screen' | 'photos' | 'files' | 'whiteboard'

export type MeetingShareContentItem = {
  kind: MeetingShareContentKind
  label: string
  hint: string
}

export function meetingShareContentItems(input?: {
  supportsScreenShare?: boolean
  supportsWhiteboard?: boolean
  supportsPhotos?: boolean
  supportsFiles?: boolean
}): MeetingShareContentItem[] {
  const items: MeetingShareContentItem[] = []
  if (input?.supportsScreenShare !== false) {
    items.push({
      kind: 'screen',
      label: 'Screen',
      hint: 'Share your display',
    })
  }
  if (input?.supportsPhotos !== false) {
    items.push({
      kind: 'photos',
      label: 'Photos',
      hint: 'Share a photo in chat',
    })
  }
  if (input?.supportsFiles !== false) {
    items.push({
      kind: 'files',
      label: 'Documents',
      hint: 'Share a file in chat',
    })
  }
  if (input?.supportsWhiteboard !== false) {
    items.push({
      kind: 'whiteboard',
      label: 'Whiteboard',
      hint: 'Open collaborative board',
    })
  }
  return items
}

export function meetingShareContentLabel(kind: MeetingShareContentKind): string {
  return meetingShareContentItems().find((item) => item.kind === kind)?.label ?? kind
}
