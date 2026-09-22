export const VIRTUAL_BACKGROUND_EFFECT_NAME = 'sheconomyVirtualBackground'

/** Keep published camera at 720p. The native processor downsamples internally. */
export const EFFECT_CAPTURE = { width: 1280, height: 720, frameRate: 24 } as const
export const NORMAL_CAPTURE = { width: 1280, height: 720, frameRate: 24 } as const

export type NativeVideoEffectsModuleLike = {
  registerProcessor?: () => boolean
  isSupported?: () => boolean
  configure?: (options: Record<string, unknown>) => void
} | null

export type NativeVideoEffectsProbe = 'missing' | 'retry' | 'ready'

export function nativeVideoEffectsProbe(
  native: NativeVideoEffectsModuleLike | undefined,
): NativeVideoEffectsProbe {
  if (!native) return 'missing'
  try {
    // A successful register is enough. isSupported() used to default to false
    // when React context was still null, which permanently disabled effects.
    if (native.registerProcessor?.() === true) return 'ready'
    return 'retry'
  } catch {
    return 'retry'
  }
}

export async function waitForNativeVideoEffects(
  native: NativeVideoEffectsModuleLike | undefined,
  options?: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> },
): Promise<boolean> {
  const attempts = options?.attempts ?? 12
  const delayMs = options?.delayMs ?? 120
  const sleep = options?.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  for (let i = 0; i < attempts; i++) {
    const probe = nativeVideoEffectsProbe(native)
    if (probe === 'ready') return true
    if (probe === 'missing') return false
    if (i < attempts - 1) await sleep(delayMs)
  }
  return nativeVideoEffectsProbe(native) === 'ready'
}

export function captureNeedsUpdate(
  current: { width?: number; height?: number } | undefined,
  target: { width: number; height: number },
  tolerance = 32,
): boolean {
  const width = Number(current?.width) || 0
  const height = Number(current?.height) || 0
  if (width < 2 || height < 2) return true
  return Math.abs(width - target.width) > tolerance || Math.abs(height - target.height) > tolerance
}

/** Avoid recopying cache files — a new path retriggered the Android processor and froze video. */
export function shouldReuseMaterializedBackground(uri: string, cacheKey: string): boolean {
  const safeKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '-')
  return uri.startsWith('file:') && uri.includes(`meeting-background-${safeKey}-`)
}

/** Packager / android_res URIs render in <Image> but BitmapFactory cannot decode them. */
export function isPackedNativeAssetUri(uri: string): boolean {
  const value = uri.toLowerCase()
  return (
    value.includes('android_res') ||
    value.includes('android_asset') ||
    value.includes('android.resource') ||
    value.startsWith('asset:') ||
    value.startsWith('res:') ||
    value.startsWith('ph://') ||
    value.startsWith('assets-library:') ||
    /[?&]platform=android\b/.test(value) ||
    (value.startsWith('http') && value.includes('/assets/'))
  )
}

/** True only for paths the Android/iOS frame processor can open. */
export function nativeProcessorCanDecodeImageUri(uri: string | undefined): boolean {
  if (!uri) return false
  if (isPackedNativeAssetUri(uri)) return false
  if (uri.startsWith('http://') || uri.startsWith('https://')) return false
  if (uri.startsWith('file:') || uri.startsWith('content:')) return true
  return uri.startsWith('/') && !uri.startsWith('//')
}
