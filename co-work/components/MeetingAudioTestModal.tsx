import { useEffect, useRef, useState } from 'react'
import { Platform, ScrollView, useWindowDimensions } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { AppBottomSheet, Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type DeviceItem = {
  deviceId: string
  label: string
}

type MeetingAudioTestModalProps = {
  open: boolean
  onClose: () => void
  /** Optional alias used by waiting-room / lobby callers. */
  onOpenChange?: (open: boolean) => void
}

/**
 * Zoom-style speaker + mic test.
 * Portaled above InstantMeetingHost so Close / Yes / Finish stay tappable.
 */
export function MeetingAudioTestModal({ open, onClose, onOpenChange }: MeetingAudioTestModalProps) {
  const { ui } = useCoWorkTheme()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()

  const [step, setStep] = useState<'speaker' | 'mic' | 'success'>('speaker')
  const [speakers, setSpeakers] = useState<DeviceItem[]>([])
  const [microphones, setMicrophones] = useState<DeviceItem[]>([])
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('')
  const [selectedMic, setSelectedMic] = useState<string>('')
  const [micLevel, setMicLevel] = useState<number>(0)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [isPlayingBack, setIsPlayingBack] = useState<boolean>(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const chimeOscRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const close = () => {
    stopAllAudio()
    onOpenChange?.(false)
    onClose()
  }

  useEffect(() => {
    if (!open) {
      stopAllAudio()
      setStep('speaker')
      return
    }

    void enumerateDevices()
    startSpeakerChime()

    return () => {
      stopAllAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function enumerateDevices() {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      setSpeakers([{ deviceId: 'default', label: 'Default System Speaker' }])
      setMicrophones([{ deviceId: 'default', label: 'Default System Microphone' }])
      return
    }

    try {
      // Unlock device labels (and mic permission) inside this gesture-driven modal.
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        probe.getTracks().forEach((track) => track.stop())
      } catch {
        // Still enumerate; labels may be blank until permission is granted.
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      const outs: DeviceItem[] = []
      const ins: DeviceItem[] = []

      devices.forEach((d, i) => {
        if (d.kind === 'audiooutput') {
          outs.push({ deviceId: d.deviceId || `spk-${i}`, label: d.label || `Speaker ${outs.length + 1}` })
        } else if (d.kind === 'audioinput') {
          ins.push({ deviceId: d.deviceId || `mic-${i}`, label: d.label || `Microphone ${ins.length + 1}` })
        }
      })

      if (outs.length === 0) outs.push({ deviceId: 'default', label: 'Default System Speaker' })
      if (ins.length === 0) ins.push({ deviceId: 'default', label: 'Default System Microphone' })

      setSpeakers(outs)
      setMicrophones(ins)
      setSelectedSpeaker(outs[0]?.deviceId || 'default')
      setSelectedMic(ins[0]?.deviceId || 'default')
    } catch {
      setSpeakers([{ deviceId: 'default', label: 'Default System Speaker' }])
      setMicrophones([{ deviceId: 'default', label: 'Default System Microphone' }])
    }
  }

  function startSpeakerChime() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx

      const notes = [523.25, 659.25, 783.99, 1046.5]
      let noteIdx = 0

      const playChord = () => {
        if (ctx.state === 'suspended') void ctx.resume()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = notes[noteIdx % notes.length]!
        noteIdx += 1
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.5)
      }

      playChord()
      chimeOscRef.current = window.setInterval(playChord, 900) as unknown as number
    } catch {
      // Soft-fail — UI still lets the user continue.
    }
  }

  function stopSpeakerChime() {
    if (chimeOscRef.current !== null && typeof window !== 'undefined') {
      clearInterval(chimeOscRef.current)
      chimeOscRef.current = null
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }

  async function startMicTest() {
    stopSpeakerChime()
    setStep('mic')
    setIsRecording(true)
    setIsPlayingBack(false)
    setMicLevel(0)

    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setIsRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic && selectedMic !== 'default' ? { deviceId: { exact: selectedMic } } : true,
        video: false,
      })
      streamRef.current = stream

      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(data)
          let sum = 0
          for (let i = 0; i < data.length; i += 1) sum += data[i] ?? 0
          setMicLevel(Math.min(1, sum / (data.length * 180)))
          animFrameRef.current = requestAnimationFrame(tick)
        }
        tick()
      }

      if (typeof MediaRecorder !== 'undefined') {
        audioChunksRef.current = []
        const recorder = new MediaRecorder(stream)
        mediaRecorderRef.current = recorder
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data)
        }
        recorder.onstop = () => {
          setIsRecording(false)
          setIsPlayingBack(true)
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          audio.onended = () => {
            setIsPlayingBack(false)
            URL.revokeObjectURL(url)
          }
          void audio.play().catch(() => setIsPlayingBack(false))
        }
        recorder.start()
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop()
        }, 2500)
      } else {
        setIsRecording(false)
      }
    } catch {
      setIsRecording(false)
      setMicLevel(0)
    }
  }

  function stopAllAudio() {
    stopSpeakerChime()
    if (animFrameRef.current !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  if (!open) return null

  const maxCardHeight = Math.max(320, Math.min(560, windowHeight - insets.top - insets.bottom - 48))

  const card = (
    <YStack
      width="100%"
      maxWidth={440}
      maxHeight={maxCardHeight}
      backgroundColor={ui.surfaceElevated}
      borderRadius={16}
      borderWidth={1}
      borderColor={ui.borderSoft}
      overflow="hidden"
      style={{
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.5)',
      }}
    >
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop="$4"
        paddingBottom="$2"
      >
        <XStack alignItems="center" gap="$2.5" flex={1} minWidth={0}>
          <YStack
            width={32}
            height={32}
            borderRadius={16}
            backgroundColor="rgba(216, 27, 96, 0.15)"
            alignItems="center"
            justifyContent="center"
          >
            <Icons.Volume2 size={18} color={ui.brandLight} />
          </YStack>
          <Text fontSize={17} fontWeight="800" color={ui.text} numberOfLines={1}>
            Testing Audio
          </Text>
        </XStack>
        <Button
          tone="ghost"
          size="$3"
          circular
          minWidth={44}
          minHeight={44}
          icon={<Icons.X size={18} color={ui.text} />}
          onPress={close}
          accessibilityLabel="Close audio test"
        />
      </XStack>

      <ScrollView
        style={{ flexGrow: 1, flexShrink: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'speaker' ? (
          <YStack gap="$4" paddingVertical="$2">
            <YStack gap="$1.5">
              <Text fontSize={15} fontWeight="700" color={ui.text}>
                Do you hear a ringtone?
              </Text>
              <Text fontSize={13} color={ui.textSecondary}>
                We are playing a test chime through your speaker.
              </Text>
            </YStack>
            <YStack
              backgroundColor={ui.surface}
              borderRadius={12}
              borderWidth={1}
              borderColor={ui.borderSoft}
              padding="$3"
              gap="$1.5"
            >
              <Text fontSize={11} fontWeight="700" color={ui.textMuted} textTransform="uppercase">
                Speaker
              </Text>
              <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={2}>
                {speakers.find((s) => s.deviceId === selectedSpeaker)?.label || 'Default Speaker'}
              </Text>
            </YStack>
          </YStack>
        ) : null}

        {step === 'mic' ? (
          <YStack gap="$4" paddingVertical="$2">
            <YStack gap="$1.5">
              <Text fontSize={15} fontWeight="700" color={ui.text}>
                Speak and pause — do you hear a replay?
              </Text>
              <Text fontSize={13} color={ui.textSecondary}>
                {isRecording
                  ? 'Listening to your voice…'
                  : isPlayingBack
                    ? 'Replaying audio back to you…'
                    : 'Audio test in progress…'}
              </Text>
            </YStack>
            <YStack
              backgroundColor={ui.surface}
              borderRadius={12}
              borderWidth={1}
              borderColor={ui.borderSoft}
              padding="$3"
              gap="$2.5"
            >
              <Text fontSize={11} fontWeight="700" color={ui.textMuted} textTransform="uppercase">
                Microphone
              </Text>
              <Text fontSize={13} fontWeight="600" color={ui.text} numberOfLines={2}>
                {microphones.find((m) => m.deviceId === selectedMic)?.label || 'Default Mic'}
              </Text>
              <YStack
                width="100%"
                height={10}
                borderRadius={5}
                backgroundColor={ui.border}
                overflow="hidden"
              >
                <YStack
                  height="100%"
                  width={`${Math.round(micLevel * 100)}%`}
                  backgroundColor={ui.live}
                  borderRadius={5}
                />
              </YStack>
            </YStack>
          </YStack>
        ) : null}

        {step === 'success' ? (
          <YStack gap="$4" alignItems="center" paddingVertical="$4">
            <YStack
              width={54}
              height={54}
              borderRadius={27}
              backgroundColor="rgba(16, 185, 129, 0.18)"
              alignItems="center"
              justifyContent="center"
            >
              <Icons.Check size={28} color={ui.live} />
            </YStack>
            <YStack gap="$1" alignItems="center">
              <Text fontSize={17} fontWeight="800" color={ui.text} textAlign="center">
                Speaker and microphone look good
              </Text>
              <Text fontSize={13} color={ui.textSecondary} textAlign="center">
                You can return to the meeting whenever you’re ready.
              </Text>
            </YStack>
          </YStack>
        ) : null}
      </ScrollView>

      <YStack
        paddingHorizontal="$4"
        paddingTop="$2"
        paddingBottom={Math.max(insets.bottom, 16)}
        gap="$2"
        borderTopWidth={1}
        borderTopColor={ui.borderSoft}
        backgroundColor={ui.surfaceElevated}
      >
        {step === 'speaker' ? (
          <XStack gap="$3">
            <Button
              tone="outline"
              borderRadius={10}
              height={48}
              flex={1}
              onPress={() => {
                if (speakers.length > 1) {
                  const curIdx = speakers.findIndex((s) => s.deviceId === selectedSpeaker)
                  const next = speakers[(curIdx + 1) % speakers.length]
                  if (next) setSelectedSpeaker(next.deviceId)
                }
              }}
            >
              No (Switch)
            </Button>
            <Button
              tone="primary"
              backgroundColor={ui.brand}
              borderRadius={10}
              height={48}
              flex={1}
              onPress={() => void startMicTest()}
            >
              Yes
            </Button>
          </XStack>
        ) : null}

        {step === 'mic' ? (
          <XStack gap="$3">
            <Button
              tone="outline"
              borderRadius={10}
              height={48}
              flex={1}
              onPress={() => {
                if (microphones.length > 1) {
                  const curIdx = microphones.findIndex((m) => m.deviceId === selectedMic)
                  const next = microphones[(curIdx + 1) % microphones.length]
                  if (next) setSelectedMic(next.deviceId)
                }
                void startMicTest()
              }}
            >
              No (Try Again)
            </Button>
            <Button
              tone="primary"
              backgroundColor={ui.brand}
              borderRadius={10}
              height={48}
              flex={1}
              onPress={() => {
                stopAllAudio()
                setStep('success')
              }}
            >
              Yes
            </Button>
          </XStack>
        ) : null}

        {step === 'success' ? (
          <Button
            tone="primary"
            backgroundColor={ui.brand}
            borderRadius={10}
            height={48}
            width="100%"
            onPress={close}
          >
            Back to meeting
          </Button>
        ) : (
          <Button tone="ghost" borderRadius={10} height={44} width="100%" onPress={close}>
            Cancel and return
          </Button>
        )}
      </YStack>
    </YStack>
  )

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
      title="Test speaker and microphone"
      showHandle
      scrollable
    >
      {card}
    </AppBottomSheet>
  )
}
