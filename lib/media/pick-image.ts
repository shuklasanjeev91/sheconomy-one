export type PickedImage = {
  uri: string
  mimeType: string
  fileName?: string
  file?: File
}

export type PickImagesOptions = {
  multiple?: boolean
  maxCount?: number
}

export async function pickImages(_options?: PickImagesOptions): Promise<PickedImage[]> {
  return []
}

export async function pickedImageToBlob(image: PickedImage): Promise<Blob> {
  if (image.file) return image.file
  const response = await fetch(image.uri)
  if (!response.ok) {
    throw new Error('Could not read the selected image.')
  }
  return response.blob()
}
