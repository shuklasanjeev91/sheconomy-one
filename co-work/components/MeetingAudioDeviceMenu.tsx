import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme, useMeetingControlPalette } from '~/co-work/lib/theme'
import type { MeetingAudioQuality } from '~/co-work/lib/meeting-audio-quality'

type DeviceItem = {
  deviceId: string
  label: string
}

function toMenuItems(
  devices: Array<{ id: string; label: string }>,
  fallback: DeviceItem,
): DeviceItem[] {
  if (devices.length === 0) return [fallback]
  return devices.map((device) => ({ deviceId: device.id, label: device.label || fallback.label }))
}

type AudioDeviceMenuProps = {
  open: boolean
  onClose: () => void
  onOpenAudioSettings?: () => void
  onOpenAudioTest?: () => void
  audioQuality?: MeetingAudioQuality
}

export function MeetingAudioDeviceFlyout({
  open,
  onClose,
  onOpenAudioSettings,
  onOpenAudioTest,
  audioQuality,
}: AudioDeviceMenuProps) {
  const { ui } = useCoWorkTheme()
  const palette = useMeetingControlPalette()
  const [microphones, setMicrophones] = useState<DeviceItem[]>([])
  const [speakers, setSpeakers] = useState<DeviceItem[]>([])
  const [activeMic, setActiveMic] = useState<string>('default')
  const [activeSpeaker, setActiveSpeaker] = useState<string>('default')

  useEffect(() => {
    if (!open) return

    if (audioQuality && (audioQuality.inputDevices.length > 0 || audioQuality.outputDevices.length > 0)) {
      setMicrophones(
        toMenuItems(audioQuality.inputDevices, { deviceId: 'default', label: 'Default System Microphone' }),
      )
      setSpeakers(
        toMenuItems(audioQuality.outputDevices, { deviceId: 'default', label: 'Default System Speaker' }),
      )
      if (audioQuality.activeInputDeviceId) setActiveMic(audioQuality.activeInputDeviceId)
      if (audioQuality.activeOutputDeviceId) setActiveSpeaker(audioQuality.activeOutputDeviceId)
      return
    }

    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      setMicrophones([
        { deviceId: 'default', label: 'Default System Microphone' },
        { deviceId: 'internal', label: 'Built-in Audio Input' },
      ])
      setSpeakers([
        { deviceId: 'default', label: 'Default System Speaker' },
        { deviceId: 'internal', label: 'Built-in Speaker' },
      ])
      return
    }

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const ins: DeviceItem[] = []
      const outs: DeviceItem[] = []
      devices.forEach((d, i) => {
        if (d.kind === 'audioinput') {
          ins.push({ deviceId: d.deviceId || `mic-${i}`, label: d.label || `Microphone ${ins.length + 1}` })
        } else if (d.kind === 'audiooutput') {
          outs.push({ deviceId: d.deviceId || `spk-${i}`, label: d.label || `Speaker ${outs.length + 1}` })
        }
      })
      if (ins.length === 0) ins.push({ deviceId: 'default', label: 'Default System Microphone' })
      if (outs.length === 0) outs.push({ deviceId: 'default', label: 'Default System Speaker' })
      setMicrophones(ins)
      setSpeakers(outs)
    }).catch(() => {
      setMicrophones([{ deviceId: 'default', label: 'Default Microphone' }])
      setSpeakers([{ deviceId: 'default', label: 'Default Speaker' }])
    })
  }, [
    open,
    audioQuality,
    audioQuality?.inputDevices,
    audioQuality?.outputDevices,
    audioQuality?.activeInputDeviceId,
    audioQuality?.activeOutputDeviceId,
  ])

  if (!open) return null

  const selectedMic = audioQuality?.activeInputDeviceId || activeMic
  const selectedSpeaker = audioQuality?.activeOutputDeviceId || activeSpeaker

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close audio device menu"
        style={{
          position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
        }}
        onPress={onClose}
      />
      <YStack
        position="absolute"
        bottom={70}
        left={8}
        width={280}
      backgroundColor={ui.surfaceElevated}
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.borderSoft}
      paddingVertical="$2"
      gap="$1"
      zIndex={9999}
      style={{
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
      }}
    >
      <Text
        paddingHorizontal="$3"
        paddingVertical="$1"
        fontSize={10}
        fontWeight="800"
        color={ui.textMuted}
        letterSpacing={0.5}
        textTransform="uppercase"
      >
        Select a Microphone
      </Text>
      {microphones.slice(0, 8).map((m) => {
        const isSelected = selectedMic === m.deviceId
        return (
          <XStack
            key={m.deviceId}
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$3"
            paddingVertical="$2"
            cursor="pointer"
            hoverStyle={{ backgroundColor: palette.bgHover }}
            onPress={() => {
              setActiveMic(m.deviceId)
              void audioQuality?.selectInputDevice(m.deviceId)
            }}
          >
            <Text fontSize={12} color={ui.text} numberOfLines={1} flex={1}>
              {m.label}
            </Text>
            {isSelected ? <Icons.Check size={14} color={ui.live} /> : null}
          </XStack>
        )
      })}

      <YStack height={1} backgroundColor={ui.borderSoft} marginVertical="$1.5" />

      <Text
        paddingHorizontal="$3"
        paddingVertical="$1"
        fontSize={10}
        fontWeight="800"
        color={ui.textMuted}
        letterSpacing={0.5}
        textTransform="uppercase"
      >
        Select a Speaker
      </Text>
      {speakers.slice(0, 8).map((s) => {
        const isSelected = selectedSpeaker === s.deviceId
        return (
          <XStack
            key={s.deviceId}
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$3"
            paddingVertical="$2"
            cursor="pointer"
            hoverStyle={{ backgroundColor: palette.bgHover }}
            onPress={() => {
              setActiveSpeaker(s.deviceId)
              void audioQuality?.selectOutputDevice(s.deviceId)
            }}
          >
            <Text fontSize={12} color={ui.text} numberOfLines={1} flex={1}>
              {s.label}
            </Text>
            {isSelected ? <Icons.Check size={14} color={ui.live} /> : null}
          </XStack>
        )
      })}

      <YStack height={1} backgroundColor={ui.borderSoft} marginVertical="$1.5" />

      <XStack
        alignItems="center"
        gap="$2"
        paddingHorizontal="$3"
        paddingVertical="$2"
        cursor="pointer"
        hoverStyle={{ backgroundColor: palette.bgHover }}
        onPress={() => {
          onClose()
          onOpenAudioTest?.()
        }}
      >
        <Icons.Volume2 size={15} color={ui.textSecondary} />
        <Text fontSize={12} fontWeight="600" color={ui.text}>
          Test Speaker & Microphone…
        </Text>
      </XStack>

      {onOpenAudioSettings ? (
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          paddingVertical="$2"
          cursor="pointer"
          hoverStyle={{ backgroundColor: palette.bgHover }}
          onPress={() => {
            onClose()
            onOpenAudioSettings()
          }}
        >
          <Icons.Sliders size={15} color={ui.textSecondary} />
          <Text fontSize={12} fontWeight="600" color={ui.text}>
            Audio Settings…
          </Text>
        </XStack>
      ) : null}
    </YStack>
    </>
  )
}

type VideoDeviceMenuProps = {
  open: boolean
  onClose: () => void
  onOpenVirtualBackgrounds?: () => void
  onOpenVideoSettings?: () => void
  audioQuality?: MeetingAudioQuality
}

export function MeetingVideoDeviceFlyout({
  open,
  onClose,
  onOpenVirtualBackgrounds,
  onOpenVideoSettings,
  audioQuality,
}: VideoDeviceMenuProps) {
  const { ui } = useCoWorkTheme()
  const palette = useMeetingControlPalette()
  const [cameras, setCameras] = useState<DeviceItem[]>([])
  const [activeCam, setActiveCam] = useState<string>('default')

  useEffect(() => {
    if (!open) return

    if (audioQuality && audioQuality.videoDevices.length > 0) {
      setCameras(
        toMenuItems(audioQuality.videoDevices, { deviceId: 'default', label: 'Built-in Camera' }),
      )
      if (audioQuality.activeVideoDeviceId) setActiveCam(audioQuality.activeVideoDeviceId)
      return
    }

    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      setCameras([
        { deviceId: 'default', label: 'FaceTime HD Camera' },
        { deviceId: 'external', label: 'External USB Camera' },
      ])
      return
    }

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const cams: DeviceItem[] = []
      devices.forEach((d, i) => {
        if (d.kind === 'videoinput') {
          cams.push({ deviceId: d.deviceId || `cam-${i}`, label: d.label || `Camera ${cams.length + 1}` })
        }
      })
      if (cams.length === 0) cams.push({ deviceId: 'default', label: 'Built-in Camera' })
      setCameras(cams)
    }).catch(() => {
      setCameras([{ deviceId: 'default', label: 'Built-in Camera' }])
    })
  }, [open, audioQuality, audioQuality?.videoDevices, audioQuality?.activeVideoDeviceId])

  if (!open) return null

  const selectedCam = audioQuality?.activeVideoDeviceId || activeCam

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close video device menu"
        style={{
          position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
        }}
        onPress={onClose}
      />
      <YStack
        position="absolute"
        bottom={70}
        left={60}
        width={280}
      backgroundColor={ui.surfaceElevated}
      borderRadius={12}
      borderWidth={1}
      borderColor={ui.borderSoft}
      paddingVertical="$2"
      gap="$1"
      zIndex={9999}
      style={{
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
      }}
    >
      <Text
        paddingHorizontal="$3"
        paddingVertical="$1"
        fontSize={10}
        fontWeight="800"
        color={ui.textMuted}
        letterSpacing={0.5}
        textTransform="uppercase"
      >
        Camera & background
      </Text>

      {onOpenVirtualBackgrounds ? (
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          marginHorizontal="$2"
          marginBottom="$1"
          borderRadius={10}
          backgroundColor="rgba(216, 27, 96, 0.14)"
          borderWidth={1}
          borderColor="rgba(216, 27, 96, 0.35)"
          cursor="pointer"
          hoverStyle={{ backgroundColor: 'rgba(216, 27, 96, 0.22)' }}
          onPress={() => {
            onClose()
            onOpenVirtualBackgrounds()
          }}
        >
          <Icons.Sparkles size={16} color={ui.brandLight} />
          <YStack flex={1} minWidth={0} gap={1}>
            <Text fontSize={13} fontWeight="700" color={ui.text}>
              Virtual background
            </Text>
            <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
              Blur or replace your backdrop
            </Text>
          </YStack>
          <Icons.ChevronRight size={14} color={ui.textMuted} />
        </XStack>
      ) : null}

      <Text
        paddingHorizontal="$3"
        paddingVertical="$1"
        fontSize={10}
        fontWeight="800"
        color={ui.textMuted}
        letterSpacing={0.5}
        textTransform="uppercase"
      >
        Select a Camera
      </Text>
      {cameras.slice(0, 8).map((c) => {
        const isSelected = selectedCam === c.deviceId
        return (
          <XStack
            key={c.deviceId}
            alignItems="center"
            justifyContent="space-between"
            paddingHorizontal="$3"
            paddingVertical="$2"
            cursor="pointer"
            hoverStyle={{ backgroundColor: palette.bgHover }}
            onPress={() => {
              setActiveCam(c.deviceId)
              void audioQuality?.selectVideoDevice(c.deviceId)
            }}
          >
            <Text fontSize={12} color={ui.text} numberOfLines={1} flex={1}>
              {c.label}
            </Text>
            {isSelected ? <Icons.Check size={14} color={ui.live} /> : null}
          </XStack>
        )
      })}

      <YStack height={1} backgroundColor={ui.borderSoft} marginVertical="$1.5" />

      {onOpenVideoSettings ? (
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          paddingVertical="$2"
          cursor="pointer"
          hoverStyle={{ backgroundColor: palette.bgHover }}
          onPress={() => {
            onClose()
            onOpenVideoSettings()
          }}
        >
          <Icons.Sliders size={15} color={ui.textSecondary} />
          <Text fontSize={12} fontWeight="600" color={ui.text}>
            Video Settings…
          </Text>
        </XStack>
      ) : null}
    </YStack>
    </>
  )
}
