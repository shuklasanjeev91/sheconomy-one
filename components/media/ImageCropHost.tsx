import { ImageCropSheet } from '~/components/media/ImageCropSheet'
import { resolveImageCrop, useImageCropSession } from '~/lib/media/crop-session'

/** Global host — mount once in AppShell so any pick flow can request a crop. */
export function ImageCropHost() {
  const { current } = useImageCropSession()

  return (
    <ImageCropSheet
      open={!!current}
      image={current?.image ?? null}
      aspect={current?.aspect ?? null}
      shape={current?.shape ?? 'rect'}
      title={current?.title}
      onCancel={() => resolveImageCrop(null)}
      onConfirm={(image) => resolveImageCrop(image)}
    />
  )
}
