import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalParticipant } from '@livekit/react-native'
import type { LocalVideoTrack } from 'livekit-client'
import { AppState } from 'react-native'

import MeetingVideoEffectsNative from '~/modules/meeting-video-effects'
import type { MeetingVideoEffects } from '~/co-work/lib/meeting-video-effects'
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

const EFFECT_NAME = 'sheconomyVirtualBackground'
const EFFECT_CAPTURE = { width: 640, height: 360, frameRate: 15 }
const NORMAL_CAPTURE = { width: 1280, height: 720, frameRate: 24 }

type EffectMediaStreamTrack = MediaStreamTrack & {
  _setVideoEffects(names: string[]): void
}

function getNativeTrack(track: LocalVideoTrack | undefined): EffectMediaStreamTrack | null {
  const mediaTrack = track?.mediaStreamTrack as EffectMediaStreamTrack | undefined
  return mediaTrack && typeof mediaTrack._setVideoEffects === 'function' ? mediaTrack : null
}

export function useMeetingVideoEffects(): MeetingVideoEffects {
  const { cameraTrack, isCameraEnabled } = useLocalParticipant()
  const [capability, setCapability] = useState<VideoEffectCapability>('checking')
  const [status, setStatus] = useState<VideoEffectStatus>('idle')
  const [selection, setSelection] = useState<VirtualBackgroundSelection>(OFF_BACKGROUND)
  const [error, setError] = useState<string | null>(null)
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const registeredRef = useRef(false)

  useEffect(() => {
    let supported = false
    try {
      supported = !!MeetingVideoEffectsNative?.isSupported?.()
      if (supported && !registeredRef.current) {
        registeredRef.current = !!MeetingVideoEffectsNative?.registerProcessor?.()
      }
    } catch {
      supported = false
      registeredRef.current = false
    }
    setCapability(supported && registeredRef.current ? 'supported' : 'unavailable')
    if (!(supported && registeredRef.current)) {
      setError(virtualBackgroundUnavailableMessage('native'))
    }
    void loadVirtualBackgroundPreference()
      .then(resolveVirtualBackgroundSelection)
      .then((value) => {
        // Never leave a remembered effect active when the processor is missing.
        setSelection(supported && registeredRef.current ? value : OFF_BACKGROUND)
      })
      .catch(() => setSelection(OFF_BACKGROUND))
  }, [])

  const apply = useCallback(
    async (nextValue: VirtualBackgroundSelection): Promise<boolean> => {
      const next = normalizeVirtualBackground(nextValue)
      setError(null)

      if (next.mode !== 'off' && capability !== 'supported') {
        setError(virtualBackgroundUnavailableMessage('native'))
        setStatus('error')
        return false
      }

      const track = getNativeTrack(cameraTrack?.track as LocalVideoTrack | undefined)
      if (!track && next.mode !== 'off' && isCameraEnabled) {
        setError('Start the camera before applying a virtual background.')
        setStatus('error')
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
        MeetingVideoEffectsNative?.configure?.({
          mode: resolved.mode,
          imagePath: resolved.imageUrl,
          blurRadius: resolved.blurRadius,
        })
        if (track) {
          if (resolved.mode === 'off') {
            track._setVideoEffects([])
            await track.applyConstraints(NORMAL_CAPTURE)
          } else {
            await track.applyConstraints(EFFECT_CAPTURE)
            // Bounce so a new imagePath always reloads (native caches by path).
            track._setVideoEffects([])
            track._setVideoEffects([EFFECT_NAME])
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
          await track?.applyConstraints(NORMAL_CAPTURE)
        } catch {
          // Preserve the camera even if restoring capture constraints fails.
        }
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
    selection.imageUrl,
    selection.blurRadius,
  ])

  useEffect(
    () => () => {
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
    const disableForResources = (message: string) => {
      setError(message)
      void apply(OFF_BACKGROUND).then(() => {
        setError(message)
        setStatus('error')
      })
    }
    const memorySubscription = AppState.addEventListener('memoryWarning', () => {
      if (selectionRef.current.mode === 'off') return
      disableForResources(
        'Background effect was turned off because memory is low. Your camera stays unfiltered.',
      )
    })
    const stateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || capability !== 'supported') return
      try {
        if (!MeetingVideoEffectsNative?.isSupported()) {
          setCapability('unavailable')
          disableForResources(
            'Background effect was turned off to protect device performance. Your camera stays unfiltered.',
          )
        }
      } catch {
        setCapability('unavailable')
        disableForResources(
          'Background effects became unavailable. Your camera stays unfiltered.',
        )
      }
    })
    return () => {
      memorySubscription.remove()
      stateSubscription.remove()
    }
  }, [apply, capability])

  const retry = useCallback(() => apply(selectionRef.current), [apply])
  return { capability, status, selection, error, apply, retry }
}
