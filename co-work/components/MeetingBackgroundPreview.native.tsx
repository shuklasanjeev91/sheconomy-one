// Keep first: react-native-webrtc extends DOMException while it evaluates.
import '~/lib/polyfills/install-dom-exception'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { NativeModules, Platform } from 'react-native'
import { MediaStream, mediaDevices, RTCView } from 'react-native-webrtc'

import MeetingVideoEffectsNative from '~/modules/meeting-video-effects'
import { selfViewMirrorAllowed } from '~/co-work/lib/meeting-video-mirror'
import {
  EFFECT_CAPTURE,
  nativeProcessorCanDecodeImageUri,
  VIRTUAL_BACKGROUND_EFFECT_NAME,
  waitForNativeVideoEffects,
} from '~/co-work/lib/native-video-effects'
import {
  MeetingBackgroundQuickPicker,
  type MeetingBackgroundQuickCustomItem,
} from '~/co-work/components/MeetingBackgroundQuickPicker'
import { pickImagesWithCrop } from '~/lib/media/pick-and-crop'
import { clearImageCropQueue } from '~/lib/media/crop-session'
import {
  customBackgroundSelection,
  listCustomVirtualBackgrounds,
  resolveVirtualBackgroundSelection,
  uploadCustomVirtualBackground,
} from '~/co-work/lib/virtual-background-storage'
import {
  loadVirtualBackgroundPreference,
  normalizeVirtualBackground,
  OFF_BACKGROUND,
  saveVirtualBackgroundPreference,
  type VirtualBackgroundSelection,
} from '~/co-work/lib/virtual-backgrounds'
import { ensureWebRTCGlobals } from '~/lib/webrtc/ensure-globals'
import { Icons, useAppToast, YStack } from '~/components/ui'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { getPresetThumbnailSource } from '~/co-work/lib/virtual-background-presets'

ensureWebRTCGlobals()

type NativeEffectTrack = MediaStreamTrack & {
  _setVideoEffects(names: string[]): void
  applyConstraints?: (constraints: MediaTrackConstraints) => Promise<void>
  getSettings?: () => MediaTrackSettings
}

type MeetingBackgroundPreviewProps = {
  userId?: string | null
  /**
   * When false, stop the local camera / effects so Join can open the SFU without
   * racing the lobby RTCView (Android EglThread refcount crash).
   */
  active?: boolean
  videoOverlay?: ReactNode
  /** Zoom join chrome: side VB + flip icons; picker opens on demand. */
  joinChrome?: boolean
}

export function MeetingBackgroundPreview({
  userId,
  active = true,
  videoOverlay,
  joinChrome = false,
}: MeetingBackgroundPreviewProps = {}) {
  const toast = useAppToast()
  const trackRef = useRef<(NativeEffectTrack & { id?: string }) | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const effectsSupportedRef = useRef(false)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [selection, setSelection] = useState<VirtualBackgroundSelection>(OFF_BACKGROUND)
  const [busy, setBusy] = useState(true)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [effectsAvailable, setEffectsAvailable] = useState(true)
  const [customs, setCustoms] = useState<MeetingBackgroundQuickCustomItem[]>([])
  const [pickerOpen, setPickerOpen] = useState(!joinChrome)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const facingRef = useRef<'user' | 'environment'>('user')
  /** Android: only install VideoEffectProcessor once — reinstall freezes Camera2. */
  const processorOnRef = useRef(false)

  const detachProcessor = useCallback((track: (NativeEffectTrack & { id?: string }) | undefined) => {
    if (!track) return
    try {
      if (Platform.OS === 'android' && track.id && NativeModules.WebRTCModule?.mediaStreamTrackSetVideoEffects) {
        NativeModules.WebRTCModule.mediaStreamTrackSetVideoEffects(track.id, null)
      } else {
        track._setVideoEffects([])
      }
    } catch {
      // ignore
    }
    processorOnRef.current = false
  }, [])

  const stopPreviewTrack = useCallback(() => {
    const track = trackRef.current
    const stream = streamRef.current
    trackRef.current = null
    streamRef.current = null
    setStreamUrl(null)
    processorOnRef.current = false
    try {
      detachProcessor(track ?? undefined)
    } catch {
      // Track may already be closed.
    }
    try {
      track?.stop()
      stream?.release(false)
    } catch {
      // ignore
    }
  }, [detachProcessor])

  const refreshCustoms = useCallback(async () => {
    if (!userId) {
      setCustoms([])
      return
    }
    try {
      const rows = await listCustomVirtualBackgrounds(userId)
      const items: MeetingBackgroundQuickCustomItem[] = []
      for (const row of rows) {
        try {
          const resolved = await resolveVirtualBackgroundSelection(customBackgroundSelection(row))
          items.push({
            id: row.id,
            name: row.name || 'Custom',
            imageUri: resolved.imageUrl,
            selection: {
              ...customBackgroundSelection(row),
              imageUrl: resolved.imageUrl,
            },
          })
        } catch {
          items.push({
            id: row.id,
            name: row.name || 'Custom',
            selection: customBackgroundSelection(row),
          })
        }
      }
      setCustoms(items)
    } catch {
      // Library load is best-effort on the join screen.
    }
  }, [userId])

  const applyNativeEffect = useCallback(
    async (next: VirtualBackgroundSelection) => {
      const track = trackRef.current ?? undefined
      if (!effectsSupportedRef.current) return false

      if (!track || typeof track._setVideoEffects !== 'function') return false
      if (next.mode === 'image' && !nativeProcessorCanDecodeImageUri(next.imageUrl)) return false

      if (next.mode === 'off') {
        try {
          MeetingVideoEffectsNative?.configure?.({ mode: 'off', blurRadius: 12 })
        } catch {
          // ignore
        }
        detachProcessor(track)
        return true
      }

      MeetingVideoEffectsNative?.configure?.({
        mode: next.mode,
        imagePath: next.imageUrl,
        blurRadius: next.blurRadius,
      })

      // Hot-swap config while the processor is already attached (Camera2-safe).
      if (processorOnRef.current) return true

      track._setVideoEffects([VIRTUAL_BACKGROUND_EFFECT_NAME])
      processorOnRef.current = true
      return true
    },
    [detachProcessor],
  )

  const apply = useCallback(
    async (value: VirtualBackgroundSelection) => {
      const normalized = normalizeVirtualBackground(value)
      let next = normalized
      try {
        next = await resolveVirtualBackgroundSelection(normalized)
      } catch {
        next = normalized
      }
      setSelection(next)
      await saveVirtualBackgroundPreference(next)

      if (!effectsSupportedRef.current && next.mode !== 'off') {
        setError(null)
        setBusy(false)
        return
      }

      setBusy(true)
      setError(null)
      try {
        const ok = await applyNativeEffect(next)
        if (!ok && next.mode !== 'off') {
          setError(
            'Could not preview this background on camera yet. It is saved and will apply when you join.',
          )
        }
      } catch (cause) {
        try {
          detachProcessor(trackRef.current ?? undefined)
          MeetingVideoEffectsNative?.configure?.({ mode: 'off', blurRadius: 12 })
        } catch {
          // Keep ordinary camera preview.
        }
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not preview this background. It is still saved for when you join.',
        )
      } finally {
        setBusy(false)
      }
    },
    [applyNativeEffect, detachProcessor],
  )

  const upload = useCallback(async () => {
    if (!userId) {
      setError('Sign in to upload a custom background.')
      toast.show('Sign in required', { tone: 'danger', message: 'Sign in to upload a background.' })
      return
    }
    // Never leave a stale crop sheet covering the join preview.
    clearImageCropQueue()
    try {
      const picked = await pickImagesWithCrop({
        multiple: false,
        maxCount: 1,
        aspect: [16, 9],
        skipCrop: true,
        allowsEditing: false,
      })
      const image = picked[0]
      if (!image?.uri) {
        // User cancelled the picker — stay quiet.
        return
      }
      setUploadBusy(true)
      setError(null)
      const created = await uploadCustomVirtualBackground(userId, image)
      const selectionValue = customBackgroundSelection(created)
      // Optimistic tile so the user sees the new image immediately.
      setCustoms((prev) => {
        const nextItem: MeetingBackgroundQuickCustomItem = {
          id: created.id,
          name: created.name || 'Custom',
          imageUri: created.localUri ?? selectionValue.imageUrl,
          selection: selectionValue,
        }
        return [nextItem, ...prev.filter((row) => row.id !== created.id)]
      })
      await apply(selectionValue)
      void refreshCustoms()
      toast.show('Background applied', {
        tone: 'success',
        message: 'Your custom image is ready for this meeting.',
      })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not upload this background.'
      setError(message)
      toast.show('Upload failed', { tone: 'danger', message })
    } finally {
      setUploadBusy(false)
    }
  }, [apply, refreshCustoms, toast, userId])

  useEffect(() => {
    clearImageCropQueue()
    void refreshCustoms()
  }, [refreshCustoms])

  useEffect(() => {
    if (!active) {
      stopPreviewTrack()
      setBusy(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: false,
          video: { ...EFFECT_CAPTURE, facingMode: facingRef.current },
        })
        const track = stream.getVideoTracks()[0] as unknown as (NativeEffectTrack & { id?: string }) | undefined
        if (cancelled || !active || !track) {
          stream.getTracks().forEach((t) => t.stop())
          stream.release(false)
          return
        }
        trackRef.current = track
        streamRef.current = stream
        setStreamUrl(stream.toURL())
        setBusy(false)
        processorOnRef.current = false

        const ready = await waitForNativeVideoEffects(MeetingVideoEffectsNative)
        if (cancelled || !active) return
        effectsSupportedRef.current = ready
        setEffectsAvailable(ready)

        const saved = await loadVirtualBackgroundPreference()
        if (cancelled || !active) return
        setSelection(saved)
        // Android: configure only — never attach processor on the join preview track.
        if (saved.mode !== 'off' && ready) {
          await new Promise((r) => setTimeout(r, Platform.OS === 'android' ? 120 : 80))
          if (!cancelled && active && trackRef.current === track) {
            await apply(saved)
          }
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not start camera preview.')
          setBusy(false)
        }
      }
    })()
    return () => {
      cancelled = true
      stopPreviewTrack()
      effectsSupportedRef.current = false
    }
  }, [active, apply, stopPreviewTrack])

  const flipCamera = useCallback(async () => {
    const media = trackRef.current
    if (!media || typeof media.applyConstraints !== 'function') {
      toast.show('Could not flip camera', { tone: 'danger' })
      return
    }
    const next = facingRef.current === 'user' ? 'environment' : 'user'
    try {
      await media.applyConstraints({ facingMode: next })
      facingRef.current = next
      setFacing(next)
      toast.show(next === 'environment' ? 'Rear camera' : 'Front camera', { tone: 'info' })
    } catch (cause) {
      toast.show('Could not flip camera', {
        tone: 'danger',
        message: cause instanceof Error ? cause.message : undefined,
      })
    }
  }, [toast])

  const joinSideChrome = joinChrome ? (
    <YStack
      position="absolute"
      top={12}
      right={12}
      gap={10}
      zIndex={30}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Virtual background"
        onPress={() => setPickerOpen((open) => !open)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.18)',
        }}
      >
        <Icons.Image size={20} color="#fff" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch camera"
        onPress={() => void flipCamera()}
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.55)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.18)',
        }}
      >
        <Icons.RefreshCw size={20} color="#fff" />
      </Pressable>
    </YStack>
  ) : null

  const presetThumb = selection.mode === 'image' ? getPresetThumbnailSource(selection.id) : null
  const presetThumbUri =
    presetThumb && typeof presetThumb === 'object' && 'uri' in presetThumb
      ? (presetThumb.uri ?? null)
      : null
  const selectedStripUri =
    selection.mode === 'image' ? selection.imageUrl ?? presetThumbUri : null

  return (
    <MeetingBackgroundQuickPicker
      selection={selection}
      busy={busy}
      error={error}
      effectsAvailable={effectsAvailable}
      onSelect={(value) => void apply(value)}
      onUpload={userId ? () => void upload() : undefined}
      uploadBusy={uploadBusy}
      customItems={customs}
      selectedImageUri={selectedStripUri}
      showTrayToggle={!joinChrome}
      pickerOpen={pickerOpen}
      onTogglePicker={() => setPickerOpen((open) => !open)}
      videoOverlay={
        <>
          {joinSideChrome}
          {videoOverlay}
        </>
      }
      preview={
        streamUrl ? (
          <RTCView
            streamURL={streamUrl}
            objectFit="cover"
            mirror={facing === 'user' && selfViewMirrorAllowed(true, selection.mode)}
            style={{ width: '100%', height: '100%' }}
          />
        ) : null
      }
    />
  )
}
