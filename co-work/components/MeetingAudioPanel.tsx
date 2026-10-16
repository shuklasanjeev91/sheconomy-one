import { useEffect, useState } from 'react'
import { Button, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { Platform } from 'react-native'
import { CoWorkPanelShell, CoWorkSectionLabel, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { ScheduleToggleRow } from '~/co-work/components/ScheduleFormFields'
import {
  connectionStatusLabel,
  type MeetingAudioDevice,
  type MeetingAudioQuality,
} from '~/co-work/lib/meeting-audio-quality'
import {
  loadMeetingMediaPrefs,
  saveMeetingMediaPrefs,
} from '~/co-work/lib/meeting-media-prefs'
import { showCallAudioOutputPicker } from '~/co-work/lib/call-audio'
import {
  MEETING_INTERPRETATION_CHANNELS,
  interpretationChannelLabel,
} from '~/co-work/lib/meeting-interpretation'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingAudioPanelProps = {
  audio: MeetingAudioQuality
  audioEnabled: boolean
  speakerOn: boolean
  onToggleAudio: () => void
  onToggleSpeaker: () => void
  onClose: () => void
  fullWidth?: boolean
  listenChannel?: string
  onListenChannelChange?: (channelId: string) => void
}

export function MeetingAudioPanel({
  audio,
  audioEnabled,
  speakerOn,
  onToggleAudio,
  onToggleSpeaker,
  onClose,
  fullWidth,
  listenChannel = 'floor',
  onListenChannelChange,
}: MeetingAudioPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const [originalSound, setOriginalSound] = useState(false)
  const [noiseSuppression, setNoiseSuppression] = useState(true)

  useEffect(() => {
    void loadMeetingMediaPrefs().then((prefs) => {
      setOriginalSound(!!prefs.originalSound)
      setNoiseSuppression(prefs.noiseSuppression !== false)
    })
  }, [])

  const statusTone =
    audio.connectionStatus === 'excellent'
      ? 'live'
      : audio.connectionStatus === 'good'
        ? 'brand'
        : 'warning'

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Audio & devices"
        subtitle="Microphone, speaker, camera and connection quality"
        icon={<Icons.SlidersHorizontal size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />
      <ScrollView flex={1} padding="$3">
        <YStack gap="$4" paddingBottom="$5">
          {onListenChannelChange ? (
            <YStack gap="$2">
              <CoWorkSectionLabel>Listen in</CoWorkSectionLabel>
              <Text color={coworkUi.textMuted} fontSize={12} lineHeight={17}>
                {interpretationChannelLabel(listenChannel)}. Floor is the original room. A language plays only that interpreter.
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                {MEETING_INTERPRETATION_CHANNELS.map((channel) => (
                  <Button
                    key={channel.id}
                    tone={listenChannel === channel.id ? 'primary' : 'outline'}
                    size="$2"
                    borderRadius={999}
                    onPress={() => onListenChannelChange(channel.id)}
                  >
                    {channel.id === 'floor' ? 'Floor' : channel.languageCode.toUpperCase()}
                  </Button>
                ))}
              </XStack>
            </YStack>
          ) : null}
          <YStack
            padding="$4"
            gap="$3"
            borderRadius={16}
            backgroundColor={coworkUi.surfaceMuted}
            borderWidth={1}
            borderColor={coworkUi.borderSoft}
          >
            <XStack alignItems="center" justifyContent="space-between" gap="$3">
              <YStack gap={3}>
                <Text color={coworkUi.text} fontWeight="800">
                  Connection
                </Text>
                <Text color={coworkUi.textMuted} fontSize={12}>
                  Adaptive voice quality is active
                </Text>
              </YStack>
              <CoWorkStatusPill
                label={connectionStatusLabel(audio.connectionStatus)}
                tone={statusTone}
              />
            </XStack>
            {audio.connectionStatus === 'reconnecting' ? (
              <Button
                tone="outline"
                size="$2"
                borderRadius={999}
                onPress={() => void audio.retryConnection()}
              >
                Retry audio connection
              </Button>
            ) : null}
          </YStack>

          <YStack gap="$2">
            <XStack alignItems="center" justifyContent="space-between">
              <CoWorkSectionLabel>Microphone</CoWorkSectionLabel>
              <Text
                fontSize={11}
                color={
                  audio.microphonePermission === 'denied'
                    ? coworkUi.danger
                    : audio.microphonePermission === 'granted'
                      ? coworkUi.live
                      : coworkUi.textMuted
                }
              >
                {audio.microphonePermission === 'granted'
                  ? 'Permission granted'
                  : audio.microphonePermission === 'denied'
                    ? 'Permission blocked'
                    : audio.microphonePermission === 'checking'
                      ? 'Checking permission…'
                      : 'Permission required'}
              </Text>
            </XStack>
            <YStack
              padding="$4"
              gap="$3"
              borderRadius={16}
              backgroundColor={coworkUi.surfaceMuted}
              borderWidth={1}
              borderColor={audio.microphoneTesting ? coworkUi.borderAccent : coworkUi.borderSoft}
            >
              <XStack alignItems="flex-end" gap={3} height={34}>
                {Array.from({ length: 20 }, (_, index) => {
                  const active = audio.inputLevel * 20 >= index + 1
                  return (
                    <YStack
                      key={index}
                      flex={1}
                      minWidth={3}
                      height={8 + ((index * 7) % 22)}
                      borderRadius={999}
                      backgroundColor={active ? coworkUi.live : coworkUi.borderSoft}
                    />
                  )
                })}
              </XStack>
              <Text color={coworkUi.textMuted} fontSize={12} textAlign="center">
                {audio.microphoneTesting
                  ? 'Speak now — the bars should move'
                  : audioEnabled
                    ? 'Your microphone is on'
                    : 'Your microphone is muted'}
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  tone={audioEnabled ? 'outline' : 'primary'}
                  size="$2"
                  borderRadius={999}
                  onPress={onToggleAudio}
                  icon={
                    audioEnabled ? <Icons.MicOff size={15} /> : <Icons.Mic size={15} color="white" />
                  }
                >
                  {audioEnabled ? 'Mute' : 'Unmute'}
                </Button>
                <Button
                  tone="outline"
                  size="$2"
                  borderRadius={999}
                  disabled={audio.microphoneTesting}
                  onPress={audio.testMicrophone}
                >
                  {audio.microphoneTesting ? 'Testing…' : 'Test microphone'}
                </Button>
              </XStack>
            </YStack>
          </YStack>

          <YStack gap="$2">
            <XStack alignItems="center" justifyContent="space-between">
              <CoWorkSectionLabel>Speaker</CoWorkSectionLabel>
              <Text fontSize={11} color={audio.speakerReady ? coworkUi.live : coworkUi.warning}>
                {audio.speakerReady ? 'Playback ready' : 'Tap test to enable'}
              </Text>
            </XStack>
            <XStack gap="$2" flexWrap="wrap">
              <Button
                tone="outline"
                size="$2"
                borderRadius={999}
                disabled={audio.speakerTesting}
                icon={
                  audio.speakerTesting ? <Spinner size="small" /> : <Icons.Volume2 size={15} />
                }
                onPress={() => void audio.testSpeaker()}
              >
                {audio.speakerTesting ? 'Playing…' : 'Test speaker'}
              </Button>
              {Platform.OS !== 'web' ? (
                <Button tone="outline" size="$2" borderRadius={999} onPress={onToggleSpeaker}>
                  {speakerOn ? 'Use Bluetooth or phone' : 'Use loudspeaker'}
                </Button>
              ) : null}
              {Platform.OS === 'ios' ? (
                <Button
                  tone="outline"
                  size="$2"
                  borderRadius={999}
                  onPress={() => void showCallAudioOutputPicker()}
                >
                  Bluetooth & speakers
                </Button>
              ) : null}
            </XStack>
          </YStack>

          {audio.supportsDeviceSelection && audio.inputDevices.length > 0 ? (
            <AudioDeviceList
              title="Microphone device"
              devices={audio.inputDevices}
              activeId={audio.activeInputDeviceId}
              onSelect={audio.selectInputDevice}
            />
          ) : null}

          {audio.supportsDeviceSelection && audio.outputDevices.length > 0 ? (
            <AudioDeviceList
              title="Speaker device"
              devices={audio.outputDevices}
              activeId={audio.activeOutputDeviceId}
              onSelect={audio.selectOutputDevice}
            />
          ) : null}

          {audio.supportsDeviceSelection && audio.videoDevices.length > 0 ? (
            <AudioDeviceList
              title="Camera device"
              devices={audio.videoDevices}
              activeId={audio.activeVideoDeviceId}
              onSelect={audio.selectVideoDevice}
            />
          ) : null}

          {audio.supportsDeviceSelection === false && Platform.OS === 'web' ? (
            <Text fontSize={12} color={coworkUi.textMuted} lineHeight={17}>
              Device selection is not supported in this browser. Use your system sound and camera
              settings instead.
            </Text>
          ) : null}

          <YStack gap="$2">
            <CoWorkSectionLabel>Voice processing</CoWorkSectionLabel>
            <ScheduleToggleRow
              label="Original sound"
              description="Relax noise suppression for music and instruments"
              checked={originalSound}
              onCheckedChange={(checked) => {
                setOriginalSound(checked)
                void loadMeetingMediaPrefs().then((prefs) =>
                  saveMeetingMediaPrefs({
                    ...prefs,
                    originalSound: checked,
                    noiseSuppression: !checked && noiseSuppression,
                  }),
                )
              }}
            />
            <ScheduleToggleRow
              label="Noise suppression"
              description="Reduce background noise on your microphone"
              checked={!originalSound && noiseSuppression}
              onCheckedChange={(checked) => {
                setNoiseSuppression(checked)
                void loadMeetingMediaPrefs().then((prefs) =>
                  saveMeetingMediaPrefs({
                    ...prefs,
                    originalSound: false,
                    noiseSuppression: checked,
                  }),
                )
              }}
            />
            <XStack gap="$2" flexWrap="wrap">
              {['Echo cancellation', 'Opus adaptive audio'].map((label) => (
                <XStack
                  key={label}
                  gap={5}
                  alignItems="center"
                  paddingHorizontal="$2"
                  paddingVertical={6}
                  borderRadius={999}
                  backgroundColor={coworkUi.liveMuted}
                >
                  <Icons.Check size={12} color={coworkUi.live} />
                  <Text fontSize={11} color={coworkUi.textSecondary}>
                    {label}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>

          {audio.error ? (
            <YStack
              padding="$3"
              gap="$2"
              borderRadius={14}
              backgroundColor={coworkUi.dangerMuted}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
            >
              <Text color={coworkUi.danger} fontSize={13}>
                {audio.error}
              </Text>
              <Button tone="ghost" size="$2" alignSelf="flex-start" onPress={audio.clearError}>
                Dismiss
              </Button>
            </YStack>
          ) : null}
        </YStack>
      </ScrollView>
    </CoWorkPanelShell>
  )
}

function AudioDeviceList({
  title,
  devices,
  activeId,
  onSelect,
}: {
  title: string
  devices: MeetingAudioDevice[]
  activeId: string | null
  onSelect: (deviceId: string) => Promise<void>
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  return (
    <YStack gap="$2">
      <CoWorkSectionLabel>{title}</CoWorkSectionLabel>
      {devices.map((device) => {
        const active = device.id === activeId
        return (
          <Button
            key={device.id}
            tone={active ? 'primary' : 'outline'}
            size="$2"
            borderRadius={12}
            justifyContent="flex-start"
            icon={<Icons.Check size={14} color={active ? 'white' : coworkUi.textMuted} />}
            onPress={() => void onSelect(device.id)}
          >
            {device.label}
          </Button>
        )
      })}
    </YStack>
  )
}
