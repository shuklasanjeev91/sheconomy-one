import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'visual-previews'
const MODEL = 'gemini-2.5-flash-image'
const MAX_IMAGE_BYTES = 7 * 1024 * 1024
const SIGNED_URL_SECONDS = 60 * 60
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 8

type VisualMode = 'try_on' | 'view_in_space'
type Placement = 'wall' | 'floor' | 'table'

type RequestBody = {
  action?: VisualMode
  listingId?: string
  /** Storage path inside visual-previews, e.g. `{userId}/inputs/….jpg` */
  userImagePath?: string
  placement?: Placement
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getGeminiKey() {
  return (
    Deno.env.get('GEMINI_API_KEY')?.trim() ||
    Deno.env.get('GOOGLE_AI_API_KEY')?.trim() ||
    ''
  )
}

function allowRequest(userId: string) {
  const now = Date.now()
  const current = rateBuckets.get(userId)
  if (!current || now >= current.resetAt) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (current.count >= RATE_LIMIT_MAX) return false
  current.count += 1
  return true
}

function buildPrompt(mode: VisualMode, placement: Placement) {
  if (mode === 'try_on') {
    return [
      'You are generating a virtual try-on preview for an online store.',
      'Image 1 is a photo of a person. Image 2 is a clothing/product photo.',
      'Generate a photorealistic image of the person from image 1 wearing the garment from image 2.',
      "Preserve the person's face, body pose, skin tone, and background as closely as possible.",
      'Fit the garment naturally with realistic lighting and fabric folds.',
      'Do not add logos, watermarks, or text overlays.',
      'Output only the edited photo.',
    ].join(' ')
  }

  const placementHint =
    placement === 'wall'
      ? 'Mount or hang the product on a suitable wall surface in the room, with correct perspective.'
      : placement === 'floor'
        ? 'Place the product on the floor in a natural spot with correct scale and perspective.'
        : 'Place the product on a table or surface in the room with correct scale and perspective.'

  return [
    'You are generating a "view in your room" product preview for an online store.',
    'Image 1 is a photo of a real room or wall. Image 2 is the product.',
    'Generate a photorealistic image that places the product from image 2 into the room from image 1.',
    placementHint,
    'Match lighting, shadows, and perspective so the product looks physically present.',
    'Do not invent a different room; keep the original space recognizable.',
    'Do not add logos, watermarks, or text overlays.',
    'Output only the edited photo.',
  ].join(' ')
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function fetchImageAsInline(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not download image (${response.status}).`)
  }
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
  const buffer = new Uint8Array(await response.arrayBuffer())
  if (buffer.byteLength === 0) throw new Error('Downloaded image was empty.')
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large (max 7 MB).')
  }
  return {
    mimeType: contentType.startsWith('image/') ? contentType : 'image/jpeg',
    data: bytesToBase64(buffer),
    bytes: buffer,
  }
}

async function downloadStorageImage(
  admin: ReturnType<typeof createClient>,
  path: string,
) {
  const { data, error } = await admin.storage.from(BUCKET).download(path)
  if (error || !data) {
    throw new Error(error?.message || 'Could not load your uploaded photo.')
  }
  const buffer = new Uint8Array(await data.arrayBuffer())
  if (buffer.byteLength === 0) throw new Error('Uploaded photo was empty.')
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Uploaded photo is too large (max 7 MB).')
  }
  const mimeType = data.type?.startsWith('image/') ? data.type : 'image/jpeg'
  return { mimeType, data: bytesToBase64(buffer), bytes: buffer }
}

type GeminiPart = {
  text?: string
  inlineData?: { mimeType?: string; data?: string }
  inline_data?: { mime_type?: string; data?: string }
}

async function callGemini(apiKey: string, prompt: string, userImage: { mimeType: string; data: string }, productImage: { mimeType: string; data: string }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: userImage.mimeType, data: userImage.data } },
            { inlineData: { mimeType: productImage.mimeType, data: productImage.data } },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error?.status ||
      `Gemini request failed (${response.status}).`
    const err = new Error(String(message))
    ;(err as Error & { status?: number }).status = response.status
    throw err
  }

  const parts: GeminiPart[] =
    payload?.candidates?.[0]?.content?.parts ??
    payload?.candidates?.[0]?.content?.Parts ??
    []

  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data
    const data = inline?.data
    const mime =
      inline?.mimeType ??
      (inline as { mime_type?: string } | undefined)?.mime_type ??
      'image/jpeg'
    if (data) {
      return { mimeType: mime, data }
    }
  }

  const blockReason = payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason
  throw new Error(
    blockReason
      ? `Image generation was blocked (${blockReason}). Try a clearer photo.`
      : 'Gemini did not return an image. Try again with a clearer photo.',
  )
}

function decodeBase64(data: string) {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function primaryListingImageUrl(listing: {
  listing_images?: Array<{ image_url?: string | null; is_primary?: boolean | null; display_order?: number | null }> | null
}) {
  const images = [...(listing.listing_images ?? [])].filter((row) => row.image_url)
  if (images.length === 0) return null
  images.sort((a, b) => {
    const primary = Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
    if (primary !== 0) return primary
    return (a.display_order ?? 0) - (b.display_order ?? 0)
  })
  return images[0]?.image_url ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = getGeminiKey()
    if (!apiKey) {
      return jsonResponse(
        {
          error: 'Visual preview is not configured. Set GEMINI_API_KEY on the Edge Function.',
          unavailable: true,
        },
        503,
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Sign in to use visual preview.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Sign in to use visual preview.' }, 401)
    }

    const userId = authData.user.id
    if (!allowRequest(userId)) {
      return jsonResponse({ error: 'Too many previews. Please wait a minute and try again.' }, 429)
    }

    const body = (await req.json()) as RequestBody
    const action = body.action
    const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : ''
    const userImagePath = typeof body.userImagePath === 'string' ? body.userImagePath.trim() : ''
    const placement: Placement =
      body.placement === 'floor' || body.placement === 'table' || body.placement === 'wall'
        ? body.placement
        : 'wall'

    if (action !== 'try_on' && action !== 'view_in_space') {
      return jsonResponse({ error: 'action must be try_on or view_in_space.' }, 400)
    }
    if (!listingId) return jsonResponse({ error: 'listingId is required.' }, 400)
    if (!userImagePath) return jsonResponse({ error: 'userImagePath is required.' }, 400)
    if (!userImagePath.startsWith(`${userId}/`)) {
      return jsonResponse({ error: 'Invalid photo path.' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey || anonKey)

    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select(
        'id, title, is_active, listing_status, listing_images(image_url, is_primary, display_order)',
      )
      .eq('id', listingId)
      .maybeSingle()

    if (listingError) return jsonResponse({ error: listingError.message }, 400)
    if (!listing) return jsonResponse({ error: 'Listing not found.' }, 404)

    const productUrl = primaryListingImageUrl(listing)
    if (!productUrl) {
      return jsonResponse({ error: 'This listing has no product image to preview with.' }, 400)
    }

    const [userImage, productImage] = await Promise.all([
      downloadStorageImage(admin, userImagePath),
      fetchImageAsInline(productUrl),
    ])

    const prompt = buildPrompt(action, placement)
    let generated: { mimeType: string; data: string }
    try {
      generated = await callGemini(apiKey, prompt, userImage, productImage)
    } catch (error) {
      const status = (error as Error & { status?: number }).status
      const message = error instanceof Error ? error.message : 'Image generation failed.'
      if (status === 429 || /quota|rate|RESOURCE_EXHAUSTED|limit:\s*0|free_tier/i.test(message)) {
        const billingBlocked = /limit:\s*0|free_tier/i.test(message)
        return jsonResponse(
          {
            error: billingBlocked
              ? 'Gemini image generation is blocked for this API key (quota limit 0). Enable billing in Google AI Studio, create a new key, and update GEMINI_API_KEY on visual-commerce.'
              : 'AI preview quota exceeded. Please try again in a minute.',
            code: 'gemini_quota',
          },
          429,
        )
      }
      return jsonResponse({ error: message, code: 'gemini_failed' }, 502)
    }

    const ext = generated.mimeType.includes('png')
      ? 'png'
      : generated.mimeType.includes('webp')
        ? 'webp'
        : 'jpg'
    const resultPath = `${userId}/${listingId}/${crypto.randomUUID()}.${ext}`
    const bytes = decodeBase64(generated.data)

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(resultPath, bytes, {
      contentType: generated.mimeType.startsWith('image/') ? generated.mimeType : 'image/jpeg',
      upsert: true,
    })
    if (uploadError) {
      return jsonResponse({ error: uploadError.message || 'Could not store preview result.' }, 500)
    }

    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(resultPath, SIGNED_URL_SECONDS)

    if (signError || !signed?.signedUrl) {
      return jsonResponse({ error: signError?.message || 'Could not create preview URL.' }, 500)
    }

    return jsonResponse({
      mode: action,
      resultUrl: signed.signedUrl,
      resultPath,
      expiresInSeconds: SIGNED_URL_SECONDS,
      listingId,
      listingTitle: listing.title ?? null,
      model: MODEL,
    })
  } catch (error) {
    console.error('visual-commerce error:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Visual preview failed.' },
      500,
    )
  }
})
