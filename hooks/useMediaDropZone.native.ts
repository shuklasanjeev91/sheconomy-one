import type { MediaDropAccept } from '~/lib/media/files-from-data-transfer'
import type { PickedImage } from '~/lib/media/pick-image'

type UseMediaDropZoneOptions = {
  disabled?: boolean
  accept?: MediaDropAccept
  maxCount?: number
  multiple?: boolean
  onDrop: (items: PickedImage[]) => void
}

/** Native — drag-and-drop is web-only; returns inert handlers. */
export function useMediaDropZone(_options: UseMediaDropZoneOptions) {
  return {
    isDragging: false,
    dropHandlers: {} as Record<string, never>,
    supported: false,
  }
}
