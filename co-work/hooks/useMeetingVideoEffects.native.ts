import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalParticipant } from '@livekit/react-native'
import type { LocalVideoTrack } from 'livekit-client'

import MeetingVideoEffectsNative from '~/modules/meeting-video-effects'
import type { MeetingVideoEffects } from '~/co-work/lib/meeting-video-effects'
import { resolveVirtualBackgroundSelection } from '~/co-work/lib/virtual-background-storage'
import {
  loadVirtualBackgroundPreference,
  normalizeVirtualBackground,
  OFF_BACKGROUND,
  saveVirtualBackgroundPreference,
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
      supported = !!MeetingVideoEffectsNative?.isSupported()
      if (supported && !registeredRef.current) {
        registeredRef.current = !!MeetingVideoEffectsNative?.registerProcessor()
      }
    } catch {
      supported = false
    }
    setCapability(supported && registeredRef.current ? 'supported' : 'unavailable')
    void loadVirtualBackgroundPreference()
      .then(resolveVirtualBackgroundSelection)
      .then(setSelection)
      .catch(() => setSelection(OFF_BACKGROUND))
  }, [])

  const apply = useCallback(
    async (nextValue: VirtualBackgroundSelection): Promise<boolean> => {
      const next = normalizeVirtualBackground(nextValue)
      setError(null)

      if (next.mode !== 'off' && capability !== 'supported') {
        setError('Virtual backgrounds require the latest SHEconomy app.')
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
        if (next.mode === 'image' && !next.imageUrl) {
          throw new Error('The selected background image is not available offline.')
        }
        MeetingVideoEffectsNative?.configure({
          mode: next.mode,
          imagePath: next.imageUrl,
          blurRadius: next.blurRadius,
        })
        if (track) {
          if (next.mode === 'off') {
            track._setVideoEffects([])
            await track.applyConstraints(NORMAL_CAPTURE)
          } else {
            await track.applyConstraints(EFFECT_CAPTURE)
            track._setVideoEffects([EFFECT_NAME])
          }
        }
        selectionRef.current = next
        setSelection(next)
        setStatus(next.mode === 'off' ? 'idle' : 'active')
        await saveVirtualBackgroundPreference(next)
        return true
      } catch (cause) {
        try {
          track?._setVideoEffects([])
          await track?.applyConstraints(NORMAL_CAPTURE)
        } catch {
          // Preserve the camera even if restoring capture constraints fails.
        }
        setError(cause instanceof Error ? cause.message : 'Could not apply background effect.')
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

  const retry = useCallback(() => apply(selectionRef.current), [apply])
  return { capability, status, selection, error, apply, retry }
}
