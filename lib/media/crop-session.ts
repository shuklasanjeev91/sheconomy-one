import { useSyncExternalStore } from 'react'

import type { AspectRatioTuple } from '~/lib/media/aspect'
import type { PickedImage } from '~/lib/media/pick-image'

export type ImageCropRequest = {
  id: string
  image: PickedImage
  aspect: AspectRatioTuple | null
  title?: string
}

type PendingCrop = ImageCropRequest & {
  resolve: (result: PickedImage | null) => void
}

type CropSessionState = {
  current: PendingCrop | null
}

const CLOSED: CropSessionState = { current: null }

let state: CropSessionState = CLOSED
const queue: PendingCrop[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function advance() {
  if (state.current) return
  const next = queue.shift()
  state = { current: next ?? null }
  emit()
}

/**
 * Open the global image crop sheet. Resolves with the cropped image, or null if cancelled.
 */
export function requestImageCrop(
  image: PickedImage,
  options: { aspect?: AspectRatioTuple | null; title?: string } = {},
): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const pending: PendingCrop = {
      id: `crop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      image,
      aspect: options.aspect ?? null,
      title: options.title,
      resolve,
    }
    queue.push(pending)
    advance()
  })
}

export function resolveImageCrop(result: PickedImage | null) {
  const current = state.current
  if (!current) return
  current.resolve(result)
  state = { current: null }
  emit()
  advance()
}

export function cancelImageCrop() {
  resolveImageCrop(null)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

export function useImageCropSession(): CropSessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
