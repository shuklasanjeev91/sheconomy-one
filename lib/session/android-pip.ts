import { useSyncExternalStore } from 'react'
import { Dimensions, Platform } from 'react-native'

/**
 * Android Activity Picture-in-Picture (modules/call-audio). The whole app window
 * shrinks, so GlobalSessionHost swaps in a video-only view while it is active.
 */

type PipModule = {
  isPictureInPictureSupported?: () => boolean
  isInPictureInPicture?: () => boolean
  enterPictureInPicture?: (width: number, height: number) => Promise<boolean>
  setAutoPictureInPicture?: (enabled: boolean, width: number, height: number) => Promise<void>
  addListener?: (
    event: 'onPictureInPictureModeChanged',
    listener: (event: { active: boolean }) => void,
  ) => { remove: () => void }
}

function pipModule(): PipModule | null {
  if (Platform.OS !== 'android') return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('~/modules/call-audio').default as PipModule | null) ?? null
  } catch {
    return null
  }
}

function windowAspect(): [number, number] {
  const { width, height } = Dimensions.get('window')
  return width > height ? [16, 9] : [9, 16]
}

export function androidPipSupported(): boolean {
  try {
    return pipModule()?.isPictureInPictureSupported?.() === true
  } catch {
    return false
  }
}

export async function enterAndroidPip(): Promise<boolean> {
  const mod = pipModule()
  if (!mod?.enterPictureInPicture) return false
  ensurePipSubscription()
  try {
    return await mod.enterPictureInPicture(...windowAspect())
  } catch {
    return false
  }
}

let autoPipHolders = 0

/** Ref-counted so a call screen unmounting cannot switch auto-PiP off for another live session. */
export function holdAndroidAutoPip(): () => void {
  const mod = pipModule()
  if (!mod?.setAutoPictureInPicture) return () => {}
  ensurePipSubscription()
  autoPipHolders += 1
  if (autoPipHolders === 1) void mod.setAutoPictureInPicture(true, ...windowAspect()).catch(() => {})
  let released = false
  return () => {
    if (released) return
    released = true
    autoPipHolders = Math.max(0, autoPipHolders - 1)
    if (autoPipHolders === 0) void mod.setAutoPictureInPicture?.(false, ...windowAspect()).catch(() => {})
  }
}

let pipActive = false
let subscribed = false
const listeners = new Set<() => void>()

function ensurePipSubscription() {
  if (subscribed) return
  const mod = pipModule()
  if (!mod?.addListener) return
  subscribed = true
  try {
    pipActive = mod.isInPictureInPicture?.() === true
  } catch {
    pipActive = false
  }
  mod.addListener('onPictureInPictureModeChanged', (event) => {
    pipActive = !!event?.active
    for (const listener of listeners) listener()
  })
}

export function isAndroidPipActive(): boolean {
  ensurePipSubscription()
  return pipActive
}

function subscribe(listener: () => void) {
  ensurePipSubscription()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAndroidPipActive(): boolean {
  return useSyncExternalStore(subscribe, isAndroidPipActive, () => false)
}
