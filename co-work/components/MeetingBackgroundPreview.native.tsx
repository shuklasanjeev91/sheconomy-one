import '~/lib/polyfills/install-dom-exception'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client'
import { MediaStream, RTCView } from '@livekit/react-native-webrtc'

import MeetingVideoEffectsNative from '~/modules/meeting-video-effects'
import { MeetingBackgroundQuickPicker } from '~/co-work/components/MeetingBackgroundQuickPicker'
import {
  loadVirtualBackgroundPreference,
  normalizeVirtualBackground,
  OFF_BACKGROUND,
  saveVirtualBackgroundPreference,
  type VirtualBackgroundSelection,
} from '~/co-work/lib/virtual-backgrounds'
import { resolveVirtualBackgroundSelection } from '~/co-work/lib/virtual-background-storage'
import { ensureLiveKitGlobals } from '~/lib/livekit/ensure-globals'

ensureLiveKitGlobals()

type NativeEffectTrack = MediaStreamTrack & {
  _setVideoEffects(names: string[]): void
}

export function MeetingBackgroundPreview() {
  const trackRef = useRef<LocalVideoTrack | null>(null)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [selection, setSelection] = useState<VirtualBackgroundSelection>(OFF_BACKGROUND)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback(async (value: VirtualBackgroundSelection) => {
    const next = await resolveVirtualBackgroundSelection(normalizeVirtualBackground(value))
    const track = trackRef.current?.mediaStreamTrack as NativeEffectTrack | undefined
    if (!track) return
    setBusy(true)
    setError(null)
    try {
      MeetingVideoEffectsNative?.configure({
        mode: next.mode,
        imagePath: next.imageUrl,
        blurRadius: next.blurRadius,
      })
      track._setVideoEffects(next.mode === 'off' ? [] : ['sheconomyVirtualBackground'])
      setSelection(next)
      await saveVirtualBackgroundPreference(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not preview this background.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (!MeetingVideoEffectsNative?.isSupported()) {
          throw new Error('Install the latest SHEconomy build to use virtual backgrounds.')
        }
        MeetingVideoEffectsNative.registerProcessor()
        const track = await createLocalVideoTrack({
          resolution: { width: 640, height: 360, frameRate: 15 },
        })
        if (cancelled) {
          track.stop()
          return
        }
        trackRef.current = track
        const stream = new MediaStream([track.mediaStreamTrack as never])
        setStreamUrl(stream.toURL())
        const saved = await loadVirtualBackgroundPreference()
        await apply(saved)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not start camera preview.')
        setBusy(false)
      }
    })()
    return () => {
      cancelled = true
      const track = trackRef.current
      trackRef.current = null
      try {
        ;(track?.mediaStreamTrack as NativeEffectTrack | undefined)?._setVideoEffects([])
      } catch {
        // Track may already be closed.
      }
      track?.stop()
    }
  }, [apply])

  return (
    <MeetingBackgroundQuickPicker
      selection={selection}
      busy={busy}
      error={error}
      onSelect={(value) => void apply(value)}
      preview={
        streamUrl ? (
          <RTCView
            streamURL={streamUrl}
            objectFit="cover"
            mirror
            style={{ width: '100%', height: '100%' }}
          />
        ) : null
      }
    />
  )
}
