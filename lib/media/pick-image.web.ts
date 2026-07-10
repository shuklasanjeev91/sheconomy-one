import type { PickImagesOptions, PickedImage } from '~/lib/media/pick-image'

export type { PickedImage, PickImagesOptions }

export async function pickImages(options: PickImagesOptions = {}): Promise<PickedImage[]> {
  if (typeof document === 'undefined') return []

  const maxCount = options.maxCount ?? (options.multiple ? 5 : 1)

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp,image/gif'
    input.multiple = !!options.multiple
    input.style.display = 'none'

    input.onchange = () => {
      const files = Array.from(input.files ?? []).slice(0, maxCount)
      resolve(
        files.map((file) => ({
          uri: URL.createObjectURL(file),
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
          file,
        })),
      )
      input.remove()
    }

    input.oncancel = () => {
      resolve([])
      input.remove()
    }

    document.body.appendChild(input)
    input.click()
  })
}

export async function pickedImageToBlob(image: PickedImage): Promise<Blob> {
  if (image.file) return image.file
  const response = await fetch(image.uri)
  if (!response.ok) {
    throw new Error('Could not read the selected image.')
  }
  return response.blob()
}

export function releasePickedImage(image: PickedImage) {
  if (image.file || !image.uri.startsWith('blob:')) return
  URL.revokeObjectURL(image.uri)
}
