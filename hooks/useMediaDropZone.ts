import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'

import {
  dataTransferHasFiles,
  pickedMediaFromDataTransfer,
  type MediaDropAccept,
} from '~/lib/media/files-from-data-transfer'
import type { PickedImage } from '~/lib/media/pick-image'

type UseMediaDropZoneOptions = {
  disabled?: boolean
  accept?: MediaDropAccept
  maxCount?: number
  multiple?: boolean
  onDrop: (items: PickedImage[]) => void
}

/** Web-only drag-and-drop for media files. Native returns inert handlers. */
export function useMediaDropZone({
  disabled = false,
  accept = 'image',
  maxCount = 1,
  multiple = false,
  onDrop,
}: UseMediaDropZoneOptions) {
  const [isDragging, setIsDragging] = useState(false)
  const depthRef = useRef(0)

  const reset = useCallback(() => {
    depthRef.current = 0
    setIsDragging(false)
  }, [])

  const onDragEnter = useCallback(
    (event: { preventDefault?: () => void; stopPropagation?: () => void; dataTransfer?: DataTransfer }) => {
      if (Platform.OS !== 'web' || disabled) return
      event.preventDefault?.()
      event.stopPropagation?.()
      if (!dataTransferHasFiles(event.dataTransfer ?? null)) return
      depthRef.current += 1
      setIsDragging(true)
    },
    [disabled],
  )

  const onDragOver = useCallback(
    (event: {
      preventDefault?: () => void
      stopPropagation?: () => void
      dataTransfer?: DataTransfer
    }) => {
      if (Platform.OS !== 'web' || disabled) return
      event.preventDefault?.()
      event.stopPropagation?.()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    },
    [disabled],
  )

  const onDragLeave = useCallback(
    (event: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      if (Platform.OS !== 'web' || disabled) return
      event.preventDefault?.()
      event.stopPropagation?.()
      depthRef.current = Math.max(0, depthRef.current - 1)
      if (depthRef.current === 0) setIsDragging(false)
    },
    [disabled],
  )

  const handleDrop = useCallback(
    (event: {
      preventDefault?: () => void
      stopPropagation?: () => void
      dataTransfer?: DataTransfer
    }) => {
      if (Platform.OS !== 'web' || disabled) return
      event.preventDefault?.()
      event.stopPropagation?.()
      reset()

      const limit = multiple ? maxCount : 1
      const items = pickedMediaFromDataTransfer(event.dataTransfer ?? null, {
        accept,
        maxCount: limit,
      })
      if (items.length) onDrop(items)
    },
    [accept, disabled, maxCount, multiple, onDrop, reset],
  )

  if (Platform.OS !== 'web') {
    return {
      isDragging: false,
      dropHandlers: {} as Record<string, never>,
      supported: false,
    }
  }

  return {
    isDragging,
    supported: true,
    dropHandlers: {
      onDragEnter,
      onDragOver,
      onDragLeave,
      onDrop: handleDrop,
    },
  }
}
