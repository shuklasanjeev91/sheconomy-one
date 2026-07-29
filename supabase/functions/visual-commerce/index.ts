import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'visual-previews'
const DEFAULT_IMAGE_MODELS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-3.1-flash-lite-image',
]
const MAX_IMAGE_BYTES = 7 * 1024 * 1024
const SIGNED_URL_SECONDS = 60 * 60
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20

type VisualMode = 'try_on' | 'view_in_space'
type Placement = 'wall' | 'floor' | 'table'

type RequestBody = {
  action?: VisualMode
  listingId?: string
  /** Storage path inside visual-previews, e.g. `{userId}/inputs/….jpg` */
  userImagePath?: string
  placement?: Placement
  title?: string
  category?: string
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeApiKey(raw: string | undefined | null): string {
  if (!raw) return ''
  let key = raw.trim()
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim()
  }
  if (key.toLowerCase().startsWith('bearer ')) {
    key = key.slice(7).trim()
  }
  return key
}

function collectGeminiApiKeys(): string[] {
  const candidates = [
    Deno.env.get('GEMINI_API_KEY'),
    Deno.env.get('GOOGLE_AI_API_KEY'),
  ]
  const seen = new Set<string>()
  const keys: string[] = []
  for (const candidate of candidates) {
    const key = normalizeApiKey(candidate)
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}

function preferredImageModels(): string[] {
  const preferred =
    Deno.env.get('GEMINI_IMAGE_MODEL')?.trim() ||
    Deno.env.get('GOOGLE_AI_IMAGE_MODEL')?.trim() ||
    DEFAULT_IMAGE_MODELS[0]
  return [...new Set([preferred, ...DEFAULT_IMAGE_MODELS])]
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

function buildPrompt(
  mode: VisualMode,
  placement: Placement,
  options?: { title?: string | null; category?: string | null },
) {
  const productHint = [options?.title, options?.category]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' · ')

  if (mode === 'try_on') {
    return [
      'Create a photorealistic virtual try-on preview for an online fashion store (like Amazon Try On).',
      'Image 1 is the shopper. Image 2 is the fashion product to wear.',
      productHint ? `Product context: ${productHint}.` : '',
      'Generate one image of the person from Image 1 wearing the garment/accessory from Image 2.',
      "Keep the person's face, skin tone, body proportions, pose, hair, and background unchanged.",
      'Replace or drape only the relevant clothing so fit, fabric texture, color, and lighting look natural.',
      'No logos, watermarks, text, extra people, or mannequins.',
      'Output only the edited photo.',
    ]
      .filter(Boolean)
      .join(' ')
  }

  const placementHint =
    placement === 'wall'
      ? 'Place/mount the product on a suitable wall in the room (correct height, perspective, and slight contact shadow).'
      : placement === 'floor'
        ? 'Place the product on the floor in a natural spot with realistic scale, perspective, and ground shadow.'
        : 'Place the product on a table, shelf, or surface with realistic scale, perspective, and contact shadow.'

  return [
    'Create a photorealistic “View in your room” preview for an online store (like Amazon View in your room).',
    'Image 1 is the customer’s room / wall photo. Image 2 is the product.',
    productHint ? `Product context: ${productHint}.` : '',
    'Composite the product from Image 2 into Image 1 so it looks physically present.',
    placementHint,
    'Match lighting, white balance, shadows, and perspective. Keep the original room recognizable — do not invent a different space.',
    'Remove product studio backgrounds; no logos, watermarks, or text overlays.',
    'Output only the edited photo.',
  ]
    .filter(Boolean)
    .join(' ')
}

function suggestPlacementFromText(text: string): Placement {
  const haystack = text.toLowerCase()
  if (
    /tv|television|monitor|wall art|painting|poster|canvas|frame|mirror|shelf|soundbar|curtain|clock/.test(
      haystack,
    )
  ) {
    return 'wall'
  }
  if (/table lamp|lamp|vase|candle|speaker|figurine|cushion|pillow|plant pot|tray|bowl/.test(haystack)) {
    return 'table'
  }
  if (
    /sofa|couch|chair|bed|mattress|rug|carpet|desk|dining|cabinet|bookshelf|wardrobe|ottoman|refrigerator|fridge|washing machine|floor lamp/.test(
      haystack,
    )
  ) {
    return 'floor'
  }
  return 'floor'
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

async function callGeminiOnce(
  apiKey: string,
  model: string,
  prompt: string,
  userImage: { mimeType: string; data: string },
  productImage: { mimeType: string; data: string },
  responseModalities: string[] = ['TEXT', 'IMAGE'],
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
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
        responseModalities,
      },
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.error?.status ||
      `AI request failed (${response.status}).`
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
      return { mimeType: mime, data, model }
    }
  }

  const blockReason = payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason
  throw new Error(
    blockReason
      ? `Image generation was blocked (${blockReason}). Try a clearer photo.`
      : 'AI did not return an image. Try again with a clearer photo.',
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isHardQuotaBlock(message: string) {
  // Free-tier image models often report limit: 0 — retrying cannot help.
  return /limit:\s*0|free_tier|billing details|plan and billing/i.test(message)
}

async function callGemini(
  apiKeys: string[],
  prompt: string,
  userImage: { mimeType: string; data: string },
  productImage: { mimeType: string; data: string },
) {
  const models = preferredImageModels()
  const modalityOptions = [['TEXT', 'IMAGE'], ['IMAGE']]
  let lastError: Error | null = null

  for (const apiKey of apiKeys) {
    for (const model of models) {
      for (const modalities of modalityOptions) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            return await callGeminiOnce(
              apiKey,
              model,
              prompt,
              userImage,
              productImage,
              modalities,
            )
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))
            const status = (lastError as Error & { status?: number }).status
            console.error('AI image model failed:', model, modalities.join('+'), lastError.message)
            // Paid plan required / free-tier limit 0 — stop immediately.
            if (status === 429 && isHardQuotaBlock(lastError.message)) {
              throw lastError
            }
            // Soft rate limit — brief backoff then try next modality/model.
            if (status === 429) {
              await sleep(1200)
              break
            }
            // Auth failures → try next key.
            if (status === 401 || status === 403) {
              attempt = 2
              break
            }
          }
        }
      }
    }
  }

  throw lastError ?? new Error('AI image generation failed.')
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
    const apiKeys = collectGeminiApiKeys()
    if (!apiKeys.length) {
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
    const bodyTitle = typeof body.title === 'string' ? body.title.trim() : ''
    const bodyCategory = typeof body.category === 'string' ? body.category.trim() : ''
    let placement: Placement =
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
        'id, title, category, tags, is_active, listing_status, listing_images(image_url, is_primary, display_order)',
      )
      .eq('id', listingId)
      .maybeSingle()

    if (listingError) return jsonResponse({ error: listingError.message }, 400)
    if (!listing) return jsonResponse({ error: 'Listing not found.' }, 404)

    const productUrl = primaryListingImageUrl(listing)
    if (!productUrl) {
      return jsonResponse({ error: 'This listing has no product image to preview with.' }, 400)
    }

    const listingTitle = bodyTitle || String(listing.title ?? '').trim() || null
    const listingCategory =
      bodyCategory ||
      (typeof listing.category === 'string' ? listing.category.trim() : '') ||
      null

    if (action === 'view_in_space' && !(body.placement === 'floor' || body.placement === 'table' || body.placement === 'wall')) {
      const tags = Array.isArray(listing.tags) ? listing.tags.join(' ') : ''
      placement = suggestPlacementFromText(`${listingTitle ?? ''} ${listingCategory ?? ''} ${tags}`)
    }

    const [userImage, productImage] = await Promise.all([
      downloadStorageImage(admin, userImagePath),
      fetchImageAsInline(productUrl),
    ])

    const prompt = buildPrompt(action, placement, {
      title: listingTitle,
      category: listingCategory,
    })
    let generated: { mimeType: string; data: string; model: string }
    try {
      generated = await callGemini(apiKeys, prompt, userImage, productImage)
    } catch (error) {
      const status = (error as Error & { status?: number }).status
      const message = error instanceof Error ? error.message : 'Image generation failed.'
      if (status === 429 || /quota|rate|RESOURCE_EXHAUSTED|limit:\s*0|free_tier/i.test(message)) {
        const billingBlocked = isHardQuotaBlock(message)
        return jsonResponse(
          {
            error: billingBlocked
              ? 'AI preview needs a paid Google AI Studio plan. Image try-on is not available on the free tier — enable billing for this API key, then try again.'
              : 'AI preview is rate-limited right now. Please wait about a minute and try again.',
            code: billingBlocked ? 'gemini_billing_required' : 'gemini_quota',
          },
          429,
        )
      }
      return jsonResponse(
        {
          error: /quota|rate|RESOURCE_EXHAUSTED/i.test(message)
            ? 'AI preview is rate-limited right now. Please wait about a minute and try again.'
            : message,
          code: 'gemini_failed',
        },
        502,
      )
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
      placement: action === 'view_in_space' ? placement : null,
      resultUrl: signed.signedUrl,
      resultPath,
      expiresInSeconds: SIGNED_URL_SECONDS,
      listingId,
      listingTitle,
      model: generated.model,
    })
  } catch (error) {
    console.error('visual-commerce error:', error)
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Visual preview failed.' },
      500,
    )
  }
})
