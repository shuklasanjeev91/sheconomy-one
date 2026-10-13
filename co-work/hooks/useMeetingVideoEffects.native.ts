import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, NativeModules, Platform } from 'react-native'

import MeetingVideoEffectsNative, { type NativeBackgroundConfiguration } from '~/modules/meeting-video-effects'
import type { MediasoupVideoEffectsInput } from '~/co-work/hooks/useMediasoupMeeting'
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
  getSettings?: () => { width?: number; height?: number; facingMode?: string }
  applyConstraints?: (constraints: MediaTrackConstraints) => Promise<void>
}

function getNativeTrack(track: MediaStreamTrack | null | undefined): EffectMediaStreamTrack | null {
  const native = track as EffectMediaStreamTrack | null | undefined
  return native && typeof native._setVideoEffects === 'function' ? native : null
}

/** Detach the WebRTC video processor without touching MeetingBackgroundConfig. */
function detachTrackProcessor(track: EffectMediaStreamTrack | null) {
  if (!track) return
  try {
    if (Platform.OS === 'android') {
      // CRITICAL: `_setVideoEffects([])` still installed VideoEffectProcessor and
      // froze Camera2 within ~6s ("Client must return video buffers"). Pass null
      // (or rely on the GetUserMediaImpl empty-array patch) to remove the processor.
      const id = (track as { id?: string }).id
      const webrtc = NativeModules.WebRTCModule as
        | { mediaStreamTrackSetVideoEffects?: (trackId: string, names: string[] | null) => void }
        | undefined
      if (id && typeof webrtc?.mediaStreamTrackSetVideoEffects === 'function') {
        webrtc.mediaStreamTrackSetVideoEffects(id, null)
        return
      }
    }
    track._setVideoEffects([])
  } catch {
    // ignore
  }
}

function clearTrackEffects(track: EffectMediaStreamTrack | null) {
  try {
    MeetingVideoEffectsNative?.configure?.({ mode: 'off', blurRadius: 12 })
  } catch {
    // ignore
  }
  detachTrackProcessor(track)
}

async function maybeApplyCapture(
  track: EffectMediaStreamTrack,
  target: { width: number; height: number; frameRate: number },
) {
  const settings = track.getSettings?.()
  if (!captureNeedsUpdate(settings, target)) return
  try {
    // iOS applyConstraints falls back to the front camera when facingMode is missing.
    await track.applyConstraints?.(settings?.facingMode ? { ...target, facingMode: settings.facingMode } : target)
  } catch {
    // Keep the current camera rather than restarting into a frozen tile.
  }
}

/**
 * Android: switching blur ↔ image while the processor is attached must NOT
 * detach/reattach VideoEffectProcessor — that freezes Camera2
 * ("Client must return video buffers"). Only configure() when already on.
 */
function applyBackgroundConfig(selection: {
  mode: NativeBackgroundConfiguration['mode']
  imageUrl?: string | null
  blurRadius?: number
}) {
  MeetingVideoEffectsNative?.configure?.({
    mode: selection.mode,
    imagePath: selection.imageUrl ?? undefined,
    blurRadius: selection.blurRadius ?? 12,
  })
}

export function useMeetingVideoEffects({
  cameraTrack,
  cameraEnabled: isCameraEnabled,
}: MediasoupVideoEffectsInput): MeetingVideoEffects {
  const [capability, setCapability] = useState<VideoEffectCapability>('checking')
  const [status, setStatus] = useState<VideoEffectStatus>('idle')
  const [selection, setSelection] = useState<VirtualBackgroundSelection>(OFF_BACKGROUND)
  const [error, setError] = useState<string | null>(null)
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const appliedKeyRef = useRef<string | null>(null)
  /** User must explicitly pick a background — auto-restore freezes Camera2. */
  const userAppliedRef = useRef(false)
  /** Preserve user intent across track remounts (clear effect resets appliedKey). */
  const pendingSelectionRef = useRef<VirtualBackgroundSelection | null>(null)

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
        if (cancelled) return
        selectionRef.current = value
        if (value.mode !== 'off') {
          pendingSelectionRef.current = value
          userAppliedRef.current = true
        }
        setSelection(value)
      } catch {
        if (!cancelled) setSelection(OFF_BACKGROUND)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Every new camera track must start unfiltered. Attaching sheconomyVirtualBackground
  // before the first stable frames (or restoring a saved blur/image) holds Camera2
  // buffers through toI420/composite and triggers:
  //   Camera freezed — Client must return video buffers
  useEffect(() => {
    if (!isCameraEnabled) return
    const track = getNativeTrack(cameraTrack)
    clearTrackEffects(track)
    appliedKeyRef.current = 'off'
    // Do not clear userAppliedRef here — re-apply effect restores after remount.
    setStatus('idle')
  }, [cameraTrack, isCameraEnabled])

  const apply = useCallback(
    async (nextValue: VirtualBackgroundSelection): Promise<boolean> => {
      const next = normalizeVirtualBackground(nextValue)
      setError(null)
      userAppliedRef.current = next.mode !== 'off'
      pendingSelectionRef.current = next.mode === 'off' ? null : next

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

      const track = getNativeTrack(cameraTrack)
      if (!track && next.mode !== 'off' && isCameraEnabled) {
        selectionRef.current = next
        setSelection(next)
        await saveVirtualBackgroundPreference(next)
        setStatus('loading')
        return false
      }

      setStatus('loading')
      try {
        let resolved = next
        if (next.mode === 'image') {
          try {
            resolved = await resolveVirtualBackgroundSelection(next)
          } catch (cause) {
            // Soft Android path only needs the preset id; keep selection without a cache file.
            if (Platform.OS !== 'android') throw cause
          }
        }

        // Resolve image files for the Android frame processor (cache JPEG / signed URL).
        if (resolved.mode === 'image' && !resolved.imageUrl) {
          throw new Error('The selected background image is not available offline.')
        }
        if (
          resolved.mode === 'image' &&
          !nativeProcessorCanDecodeImageUri(resolved.imageUrl)
        ) {
          throw new Error('Could not prepare this background for the camera on this device.')
        }

        if (resolved.mode === 'off') {
          clearTrackEffects(track)
          appliedKeyRef.current = 'off'
          pendingSelectionRef.current = null
        } else if (track && appliedKeyRef.current === 'on') {
          // Already processing — hot-swap config only (no processor tear-down).
          applyBackgroundConfig(resolved)
        } else {
          if (track) {
            await maybeApplyCapture(track, EFFECT_CAPTURE)
            detachTrackProcessor(track)
          }
          applyBackgroundConfig(resolved)
          if (track) {
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
        clearTrackEffects(track)
        appliedKeyRef.current = 'off'
        userAppliedRef.current = false
        pendingSelectionRef.current = null
        setError(cause instanceof Error ? cause.message : 'Could not apply background effect.')
        selectionRef.current = OFF_BACKGROUND
        setSelection(OFF_BACKGROUND)
        setStatus('error')
        return false
      }
    },
    [cameraTrack, capability, isCameraEnabled],
  )

  // Apply the saved lobby/meeting choice once the camera track is up.
  // Android waits for the first Camera2 frames so the processor does not freeze the preview.
  useEffect(() => {
    if (!isCameraEnabled || capability !== 'supported') return
    const pending = pendingSelectionRef.current ?? selectionRef.current
    if (pending.mode === 'off') return
    userAppliedRef.current = true
    const delay = Platform.OS === 'android' ? 900 : 250
    const timer = setTimeout(() => {
      void apply(pending)
    }, delay)
    return () => clearTimeout(timer)
  }, [apply, cameraTrack, capability, isCameraEnabled, selection.mode, selection.id, selection.blurRadius])

  useEffect(
    () => () => {
      appliedKeyRef.current = null
      userAppliedRef.current = false
      pendingSelectionRef.current = null
      clearTrackEffects(getNativeTrack(cameraTrack))
    },
    [cameraTrack],
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

