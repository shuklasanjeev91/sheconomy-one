import type { MediaDropAccept } from '~/lib/media/files-from-data-transfer'

/** `<input accept>` values for web file browse dialogs. */
export const WEB_FILE_INPUT_ACCEPT: Record<MediaDropAccept, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/webm,video/quicktime,video/x-m4v,video/*',
  media:
    'image/jpeg,image/png,image/webp,image/gif,image/*,video/mp4,video/webm,video/quicktime,video/x-m4v,video/*',
  any: 'image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,application/zip,*/*',
}

export function browseButtonLabel(
  accept: MediaDropAccept,
  options: { hasValue: boolean; multiple: boolean; isWeb: boolean },
): string {
  const { hasValue, multiple, isWeb } = options

  if (hasValue) {
    if (accept === 'video') return multiple ? 'Add another video' : 'Replace video'
    if (accept === 'media') return multiple ? 'Add more media' : 'Replace media'
    if (accept === 'any') return multiple ? 'Add more files' : 'Replace file'
    return multiple ? 'Add another photo' : 'Replace photo'
  }

  if (isWeb) {
    if (accept === 'video') return 'Browse videos'
    if (accept === 'media') return 'Browse media'
    if (accept === 'any') return 'Browse files'
    return 'Browse photos'
  }

  if (accept === 'video') return 'Choose video'
  if (accept === 'media') return 'Choose media'
  if (accept === 'any') return 'Choose file'
  return 'Choose photo'
}

export function pickMediaErrorLabel(accept: MediaDropAccept): string {
  if (accept === 'video') return 'Could not add video'
  if (accept === 'media') return 'Could not add media'
  if (accept === 'any') return 'Could not add file'
  return 'Could not add photo'
}

export function dropHintLabel(accept: MediaDropAccept, multiple: boolean, maxCount: number): string {
  if (accept === 'video') {
    return multiple
      ? `Drag & drop or add up to ${maxCount} videos.`
      : 'Drag & drop a video here, or upload below.'
  }
  if (accept === 'media') {
    return multiple
      ? `Drag & drop or add up to ${maxCount} photos or videos.`
      : 'Drag & drop photos or videos here, or upload below.'
  }
  if (accept === 'any') {
    return multiple
      ? `Drag & drop or add up to ${maxCount} files.`
      : 'Drag & drop a file here, or upload below.'
  }
  return multiple
    ? `Drag & drop or add up to ${maxCount} photos. First photo is the cover image.`
    : 'Drag & drop a photo here, or upload below.'
}
