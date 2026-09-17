import { readPersistentValue, writePersistentValue } from '~/lib/platform/storage'

export type VirtualBackgroundMode = 'off' | 'blur' | 'image'

export type VirtualBackgroundSelection = {
  mode: VirtualBackgroundMode
  /** Built-in preset id or custom database id. */
  id?: string
  /** Resolved URL/file URI consumed by the platform processor. */
  imageUrl?: string
  /** Storage path for a private custom image. */
  storagePath?: string
  blurRadius?: number
}

export type VideoEffectCapability = 'checking' | 'supported' | 'unavailable'
export type VideoEffectStatus = 'idle' | 'loading' | 'active' | 'error'

export const DEFAULT_BLUR_RADIUS = 12
export const MIN_BLUR_RADIUS = 5
export const MAX_BLUR_RADIUS = 24
export const VIRTUAL_BACKGROUND_PREFERENCE_KEY = 'cowork.virtual-background.v1'

export const OFF_BACKGROUND: VirtualBackgroundSelection = { mode: 'off' }
export const BLUR_BACKGROUND: VirtualBackgroundSelection = {
  mode: 'blur',
  id: 'blur',
  blurRadius: DEFAULT_BLUR_RADIUS,
}

export type WebBackgroundDeviceInfo = {
  deviceMemory?: number
  hardwareConcurrency?: number
}

/** Conservative guard: segmentation can otherwise make the ordinary camera unusable. */
export function webBackgroundResourceWarning(
  device: WebBackgroundDeviceInfo | null | undefined,
): string | null {
  if (!device) return null
  if (typeof device.deviceMemory === 'number' && device.deviceMemory <= 2) {
    return 'Virtual backgrounds are unavailable on low-memory devices. Your camera stays unfiltered.'
  }
  if (
    typeof device.hardwareConcurrency === 'number' &&
    device.hardwareConcurrency > 0 &&
    device.hardwareConcurrency <= 2
  ) {
    return 'Virtual backgrounds need more processing capacity on this device. Your camera stays unfiltered.'
  }
  return null
}

export function normalizeVirtualBackground(
  value: Partial<VirtualBackgroundSelection> | null | undefined,
): VirtualBackgroundSelection {
  if (!value || value.mode === 'off') return OFF_BACKGROUND
  if (value.mode === 'blur') {
    const radius = Number(value.blurRadius)
    return {
      mode: 'blur',
      id: 'blur',
      blurRadius: Number.isFinite(radius)
        ? Math.min(MAX_BLUR_RADIUS, Math.max(MIN_BLUR_RADIUS, radius))
        : DEFAULT_BLUR_RADIUS,
    }
  }
  if (value.mode === 'image' && (value.imageUrl || value.storagePath || value.id)) {
    return {
      mode: 'image',
      id: value.id,
      imageUrl: value.imageUrl,
      storagePath: value.storagePath,
    }
  }
  return OFF_BACKGROUND
}

export async function loadVirtualBackgroundPreference(): Promise<VirtualBackgroundSelection> {
  const raw = await readPersistentValue(VIRTUAL_BACKGROUND_PREFERENCE_KEY)
  if (!raw) return OFF_BACKGROUND
  try {
    return normalizeVirtualBackground(JSON.parse(raw) as Partial<VirtualBackgroundSelection>)
  } catch {
    return OFF_BACKGROUND
  }
}

export async function saveVirtualBackgroundPreference(
  selection: VirtualBackgroundSelection,
): Promise<void> {
  const normalized = normalizeVirtualBackground(selection)
  // Signed URLs expire; persist the stable storage path and resolve a fresh URL on load.
  const persisted =
    normalized.mode === 'image' && normalized.storagePath
      ? { ...normalized, imageUrl: undefined }
      : normalized
  await writePersistentValue(VIRTUAL_BACKGROUND_PREFERENCE_KEY, JSON.stringify(persisted))
}

export function virtualBackgroundLabel(selection: VirtualBackgroundSelection): string {
  if (selection.mode === 'blur') return 'Blur'
  if (selection.mode === 'image') return 'Virtual background'
  return 'None'
}

/** User-facing copy when segmentation cannot run; never blocks joining. */
export function virtualBackgroundUnavailableMessage(platform: 'web' | 'native'): string {
  return platform === 'web'
    ? 'Virtual backgrounds are not supported by this browser. Your camera stays unfiltered.'
    : 'Virtual backgrounds are unavailable on this device right now. Your camera stays unfiltered.'
}
