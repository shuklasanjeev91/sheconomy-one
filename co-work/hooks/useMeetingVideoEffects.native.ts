import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalParticipant } from '@livekit/react-native'
import type { LocalVideoTrack } from 'livekit-client'
import { AppState, Platform } from 'react-native'

import MeetingVideoEffectsNative from '~/modules/meeting-video-effects'
import type { MeetingVideoEffects } from '~/co-work/lib/meeting-video-effects'
import {
  captureNeedsUpdate,
  EFFECT_CAPTURE,
  nativeProcessorCanDecodeImageUri,
  VIRTUAL_BACKGROUND_EFFECT_NAME,
  waitForNativeVideoEffects,
} from '~/co-work/lib/native-video-effects'
import { resolveVirtualBackgroundSelection } from '~/co-work/lib/virtual-background-storage'
import {
  loadVirtualBackgroundPreference,
  normalizeVirtualBackground,
  OFF_BACKGROUND,
  saveVirtualBackgroundPreference,
  virtualBackgroundUnavailableMessage,
  type VideoEffectCapability,
  type VideoEffectStatus,
  type VirtualBackgroundSelection,
} from '~/co-work/lib/virtual-backgrounds'

type EffectMediaStreamTrack = MediaStreamTrack & {
  _setVideoEffects(names: string[]): void
  getSettings?: () => { width?: number; height?: number }
  applyConstraints?: (constraints: MediaTrackConstraints) => Promise<void>
}

function getNativeTrack(track: LocalVideoTrack | undefined): EffectMediaStreamTrack | null {
  const candidates: unknown[] = [track?.mediaStreamTrack]
  try {
    const fromStream = track?.mediaStream?.getVideoTracks?.() ?? []
    candidates.push(...fromStream)
  } catch {
    // ignore
  }
  for (const media of candidates) {
    const native = media as EffectMediaStreamTrack | undefined
    if (native && typeof native._setVideoEffects === 'function') return native
  }
  return null
}

async function maybeApplyCapture(track: EffectMediaStreamTrack, target: { width: number; height: number; frameRate: number }) {
  if (Platform.OS === 'android' && !captureNeedsUpdate(track.getSettings?.(), target)) return
  try {
    await track.applyConstraints?.(target)
  } catch {
    // Keep the current camera rather than restarting into a frozen tile.
  }
}

export function useMeetingVideoEffects(): MeetingVideoEffects {
  const { cameraTrack, isCameraEnabled } = useLocalParticipant()
  const [capability, setCapability] = useState<VideoEffectCapability>('checking')
  const [status, setStatus] = useState<VideoEffectStatus>('idle')
  const [selection, setSelection] = useState<VirtualBackgroundSelection>(OFF_BACKGROUND)
  const [error, setError] = useState<string | null>(null)
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const appliedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ready = await waitForNativeVideoEffects(MeetingVideoEffectsNative)
      if (cancelled) return
      if (!ready) {
        setCapability('unavailable')
        setError(virtualBackgroundUnavailableMessage('native'))
        setSelection(OFF_BACKGROUND)
        return
      }
      setCapability('supported')
      setError(null)
      try {
        const value = await resolveVirtualBackgroundSelection(await loadVirtualBackgroundPreference())
        if (!cancelled) setSelection(value)
      } catch {
        if (!cancelled) setSelection(OFF_BACKGROUND)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const apply = useCallback(
    async (nextValue: VirtualBackgroundSelection): Promise<boolean> => {
      const next = normalizeVirtualBackground(nextValue)
      setError(null)

      if (next.mode !== 'off' && capability !== 'supported') {
        if (capability === 'checking') {
          selectionRef.current = next
          setSelection(next)
          await saveVirtualBackgroundPreference(next)
          return true
        }
        setError(virtualBackgroundUnavailableMessage('native'))
        setStatus('error')
        return false
      }

      const track = getNativeTrack(cameraTrack?.track as LocalVideoTrack | undefined)
      if (!track && next.mode !== 'off' && isCameraEnabled) {
        // Camera is on but LiveKit track is still attaching — keep the pick so
        // the track-appear effect can apply blur/image without another tap.
        selectionRef.current = next
        setSelection(next)
        await saveVirtualBackgroundPreference(next)
        setStatus('loading')
        return false
      }

      setStatus('loading')
      try {
        const resolved =
          next.mode === 'image'
            ? await resolveVirtualBackgroundSelection(next)
            : next
        if (resolved.mode === 'image' && !resolved.imageUrl) {
          throw new Error('The selected background image is not available offline.')
        }
        if (
          resolved.mode === 'image' &&
          !nativeProcessorCanDecodeImageUri(resolved.imageUrl)
        ) {
          throw new Error('Could not prepare this background for the camera on this device.')
        }
        MeetingVideoEffectsNative?.configure?.({
          mode: resolved.mode,
          imagePath: resolved.imageUrl,
          blurRadius: resolved.blurRadius,
        })
        if (track) {
          if (resolved.mode === 'off') {
            track._setVideoEffects([])
            appliedKeyRef.current = 'off'
          } else {
            // Always re-attach on the current capturer. Skipping when appliedKeyRef
            // was already "on" left a new LiveKit track unfiltered (blurry 320p / no VB).
            if (Platform.OS !== 'android') {
              await maybeApplyCapture(track, EFFECT_CAPTURE)
            }
            track._setVideoEffects([])
            track._setVideoEffects([VIRTUAL_BACKGROUND_EFFECT_NAME])
            appliedKeyRef.current = 'on'
          }
        }
        selectionRef.current = resolved
        setSelection(resolved)
        setStatus(resolved.mode === 'off' ? 'idle' : 'active')
        await saveVirtualBackgroundPreference(resolved)
        return true
      } catch (cause) {
        try {
          track?._setVideoEffects([])
        } catch {
          // Preserve the camera even if restoring effects fails.
        }
        appliedKeyRef.current = 'off'
        setError(cause instanceof Error ? cause.message : 'Could not apply background effect.')
        selectionRef.current = OFF_BACKGROUND
        setSelection(OFF_BACKGROUND)
        setStatus('error')
        return false
      }
    },
    [cameraTrack?.track, capability, isCameraEnabled],
  )

  useEffect(() => {
    if (!isCameraEnabled || capability !== 'supported') return
    void apply(selectionRef.current)
  }, [
    apply,
    cameraTrack?.track,
    capability,
    isCameraEnabled,
    selection.mode,
    selection.id,
    selection.storagePath,
    selection.blurRadius,
  ])

  useEffect(
    () => () => {
      appliedKeyRef.current = null
      const track = getNativeTrack(cameraTrack?.track as LocalVideoTrack | undefined)
      try {
        track?._setVideoEffects([])
      } catch {
        // Camera may already be disposed with the room.
      }
    },
    [cameraTrack?.track],
  )

  useEffect(() => {
    const memorySubscription = AppState.addEventListener('memoryWarning', () => {
      if (selectionRef.current.mode === 'off') return
      const message =
        'Background effect was turned off because memory is low. Your camera stays unfiltered.'
      setError(message)
      void apply(OFF_BACKGROUND).then(() => {
        setError(message)
        setStatus('error')
      })
    })
    return () => memorySubscription.remove()
  }, [apply])

  const retry = useCallback(() => apply(selectionRef.current), [apply])
  return { capability, status, selection, error, apply, retry }
}
