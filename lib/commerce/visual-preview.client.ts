import type {
  VisualPreviewMode,
  VisualPreviewPlacement,
} from '~/lib/listing/visual-preview'
import type { PickedImage } from '~/lib/media/pick-image'
import { ownedAiServiceUrl } from '~/lib/ai/owned-service'

export type VisualPreviewResult = {
  mode: VisualPreviewMode
  resultUrl: string
  resultPath: string
  expiresInSeconds: number
  listingId: string
  listingTitle: string | null
  model: string
}

export async function requestTryOn(params: {
  userId?: string | null
  listingId: string
  userImage: PickedImage
  productImageUrl?: string | null
  title?: string | null
  category?: string | null
  onStatus?: (status: string) => void
}): Promise<VisualPreviewResult> {
  params.onStatus?.('Creating your try-on preview…')
  return requestSherpaTryOn(ownedAiServiceUrl(), params)
}

async function requestSherpaTryOn(
  base: string,
  params: {
    userImage: PickedImage
    productImageUrl?: string | null
    title?: string | null
    category?: string | null
  },
): Promise<VisualPreviewResult> {
  const form = new FormData()
  await appendPickedImage(form, 'person', params.userImage, 'person.jpg')
  if (params.productImageUrl) {
    try {
      const response = await fetch(params.productImageUrl)
      if (response.ok) {
        const blob = await response.blob()
        form.append('product', blob, 'product.jpg')
      }
    } catch {
      // The service can fetch the product URL itself.
    }
    form.append('productUrl', params.productImageUrl)
  }
  form.append('title', params.title ?? '')
  form.append('category', params.category ?? '')

  const timeout = (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout
  const response = await fetch(`${base}/v1/try-on`, {
    method: 'POST',
    body: form,
    signal: typeof timeout === 'function' ? timeout(90000) : undefined,
  })
  const payload = (await response.json().catch(() => null)) as
    | (VisualPreviewResult & { error?: string })
    | null
  if (!response.ok || !payload?.resultUrl) {
    throw new Error(payload?.error || 'Could not generate the try-on preview.')
  }
  return payload
}

async function appendPickedImage(form: FormData, field: string, image: PickedImage, fallbackName: string) {
  if (image.file) {
    form.append(field, image.file, image.fileName || fallbackName)
    return
  }
  const response = await fetch(image.uri)
  const blob = await response.blob()
  form.append(field, blob, image.fileName || fallbackName)
}

export async function requestViewInSpace(params: {
  userId: string
  listingId: string
  spaceImage: PickedImage
  placement?: VisualPreviewPlacement
  title?: string | null
  category?: string | null
  onStatus?: (status: string) => void
}): Promise<VisualPreviewResult> {
  throw new Error('View in your room is not available.')
}
