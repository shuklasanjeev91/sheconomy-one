import type { PickedImage } from '~/lib/media/pick-image'

export type MediaDropAccept = 'image' | 'video' | 'media' | 'any'

function matchesAccept(file: File, accept: MediaDropAccept): boolean {
  const type = (file.type || '').toLowerCase()
  if (accept === 'any') return true
  if (accept === 'image') return type.startsWith('image/')
  if (accept === 'video') return type.startsWith('video/')
  // media = images + videos
  return type.startsWith('image/') || type.startsWith('video/')
}

/** Convert browser File / FileList / DataTransfer into app PickedImage entries. */
export function pickedMediaFromFiles(
  files: FileList | File[] | null | undefined,
  options?: { accept?: MediaDropAccept; maxCount?: number },
): PickedImage[] {
  if (!files) return []
  const accept = options?.accept ?? 'image'
  const maxCount = options?.maxCount ?? 20
  const list = Array.from(files as ArrayLike<File>)
    .filter((file) => matchesAccept(file, accept))
    .slice(0, maxCount)

  return list.map((file) => ({
    uri: URL.createObjectURL(file),
    mimeType: file.type || (file.name.match(/\.mp4$/i) ? 'video/mp4' : 'image/jpeg'),
    fileName: file.name,
    file,
  }))
}

export function pickedMediaFromDataTransfer(
  dataTransfer: DataTransfer | null | undefined,
  options?: { accept?: MediaDropAccept; maxCount?: number },
): PickedImage[] {
  if (!dataTransfer?.files?.length) return []
  return pickedMediaFromFiles(dataTransfer.files, options)
}

export function dataTransferHasFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false
  if (dataTransfer.types?.includes?.('Files')) return true
  return (dataTransfer.files?.length ?? 0) > 0
}
