import { useEffect } from 'react'

import { ImageCropSheet } from '~/components/media/ImageCropSheet'
import {
  clearImageCropQueue,
  resolveImageCrop,
  useImageCropSession,
} from '~/lib/media/crop-session'

/** Global host — mount once in AppShell so any pick flow can request a crop. */
export function ImageCropHost() {
  const { current } = useImageCropSession()
  const image = current?.image ?? null
  const hasUri = !!image?.uri?.trim()

  // Never leave a crop session open without a photo — that painted crop chrome
  // over Commerce with a see-through stage (Minimize bug on iPad).
  useEffect(() => {
    if (current && !hasUri) clearImageCropQueue()
  }, [current, hasUri])

  return (
    <ImageCropSheet
      open={!!current && hasUri}
      image={hasUri ? image : null}
      aspect={current?.aspect ?? null}
      shape={current?.shape ?? 'rect'}
      title={current?.title}
      onCancel={() => resolveImageCrop(null)}
      onConfirm={(next) => resolveImageCrop(next)}
    />
  )
}
