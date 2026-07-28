import { preparePickedImagesForUpload } from '~/components/media/ImageUploadField'
import type {
  VisualPreviewMode,
  VisualPreviewPlacement,
} from '~/lib/listing/visual-preview'
import type { PickedImage } from '~/lib/media/pick-image'
import { supabase } from '~/lib/supabase'
import { uploadVisualPreviewInput } from '~/lib/supabase/storage-upload'

type InvokeErrorPayload = {
  error?: string
  unavailable?: boolean
  code?: string
}

export type VisualPreviewResult = {
  mode: VisualPreviewMode
  resultUrl: string
  resultPath: string
  expiresInSeconds: number
  listingId: string
  listingTitle: string | null
  model: string
}

/**
 * supabase-js wraps non-2xx as FunctionsHttpError with a generic message.
 * The real reason is in the JSON body on `error.context` (or sometimes `data`).
 */
async function readFunctionErrorMessage(error: unknown, data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as InvokeErrorPayload).error
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (typeof Response !== 'undefined' && context instanceof Response) {
      try {
        const body = (await context.clone().json()) as InvokeErrorPayload
        if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim()
      } catch {
        // ignore
      }
    }
    // Some supabase-js versions expose a fetch Response-like object without instanceof matching.
    if (context && typeof context === 'object' && typeof (context as { json?: unknown }).json === 'function') {
      try {
        const body = (await (context as Response).clone().json()) as InvokeErrorPayload
        if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim()
      } catch {
        // ignore
      }
    }
  }
  if (error instanceof Error && error.message && !/non-2xx/i.test(error.message)) {
    return error.message
  }
  return fallback
}

async function invokeVisualCommerce(body: Record<string, unknown>): Promise<VisualPreviewResult> {
  const { data, error } = await supabase.functions.invoke('visual-commerce', { body })

  if (error) {
    throw new Error(
      await readFunctionErrorMessage(error, data, 'Visual preview is unavailable right now.'),
    )
  }

  if (data && typeof data === 'object' && 'error' in data && (data as InvokeErrorPayload).error) {
    throw new Error(String((data as InvokeErrorPayload).error))
  }

  const result = data as VisualPreviewResult
  if (!result?.resultUrl) {
    throw new Error('Empty response from visual preview.')
  }
  return result
}

async function uploadUserPhoto(userId: string, image: PickedImage) {
  const [file] = await preparePickedImagesForUpload([image])
  if (!file) throw new Error('Could not prepare your photo.')

  const { data, error } = await uploadVisualPreviewInput(userId, file)
  if (error || !data?.path) {
    throw new Error(error ?? 'Could not upload your photo.')
  }
  return data.path
}

export async function requestTryOn(params: {
  userId: string
  listingId: string
  userImage: PickedImage
  title?: string | null
  category?: string | null
  onStatus?: (status: string) => void
}): Promise<VisualPreviewResult> {
  params.onStatus?.('Uploading your photo…')
  const userImagePath = await uploadUserPhoto(params.userId, params.userImage)
  params.onStatus?.('Creating your try-on preview…')
  return invokeVisualCommerce({
    action: 'try_on',
    listingId: params.listingId,
    userImagePath,
    title: params.title ?? null,
    category: params.category ?? null,
  })
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
  params.onStatus?.('Uploading your room photo…')
  const userImagePath = await uploadUserPhoto(params.userId, params.spaceImage)
  params.onStatus?.('Placing the product in your photo…')
  return invokeVisualCommerce({
    action: 'view_in_space',
    listingId: params.listingId,
    userImagePath,
    placement: params.placement ?? 'wall',
    title: params.title ?? null,
    category: params.category ?? null,
  })
}
