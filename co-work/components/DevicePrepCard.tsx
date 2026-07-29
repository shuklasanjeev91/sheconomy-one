import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { ensureMeetingMediaPermissions } from '~/co-work/lib/meeting-media-permissions'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'

type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt'

/**
 * Pre-meeting camera/mic readiness check — works on web, iOS, and Android.
 * Expo Camera is loaded only on native so a module failure never blanks Co-Work on web.
 */
export function DevicePrepCard() {
  const { ui: coworkUi } = useCoWorkTheme()
  const [camera, setCamera] = useState<PermissionState>('unknown')
  const [mic, setMic] = useState<PermissionState>('unknown')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void refreshStatus()
  }, [])

  async function refreshStatus() {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.permissions?.query) {
        const [cam, audio] = await Promise.all([
          navigator.permissions.query({ name: 'camera' as PermissionName }).catch(() => null),
          navigator.permissions.query({ name: 'microphone' as PermissionName }).catch(() => null),
        ])
        setCamera(mapWebState(cam?.state))
        setMic(mapWebState(audio?.state))
        return
      }

      if (Platform.OS === 'web') {
        setCamera('prompt')
        setMic('prompt')
        return
      }

      const Camera = (await import('expo-camera')).Camera
      const current = await Camera.getCameraPermissionsAsync()
      setCamera(current.granted ? 'granted' : current.canAskAgain ? 'prompt' : 'denied')
      const micCurrent = await Camera.getMicrophonePermissionsAsync()
      setMic(micCurrent.granted ? 'granted' : micCurrent.canAskAgain ? 'prompt' : 'denied')
    } catch {
      setCamera('unknown')
      setMic('unknown')
    }
  }

  async function enableDevices() {
    setBusy(true)
    try {
      const result = await ensureMeetingMediaPermissions()
      setCamera(result.cameraGranted ? 'granted' : 'denied')
      setMic(result.microphoneGranted ? 'granted' : 'denied')
    } finally {
      setBusy(false)
      void refreshStatus()
    }
  }

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={coworkUi.radius.card}
      borderWidth={1}
      borderColor={coworkUi.glassBorder}
      style={coworkGlassStyle(coworkUi, true)}
    >
      <XStack alignItems="center" gap="$2">
        <Icons.ShieldCheck size={18} color={coworkUi.brand} />
        <Text fontWeight="800" fontSize={16} color={coworkUi.text}>
          Device prep
        </Text>
      </XStack>
      <Text fontSize={13} color={coworkUi.textSecondary} lineHeight={19}>
        Check camera and microphone before you join a meeting.
      </Text>
      <XStack gap="$3" flexWrap="wrap">
        <PermissionChip kind="Camera" state={camera} />
        <PermissionChip kind="Mic" state={mic} />
      </XStack>
      {camera !== 'granted' || mic !== 'granted' ? (
        <Button
          size="$3"
          borderRadius={999}
          backgroundColor={coworkUi.brand}
          color="white"
          disabled={busy}
          onPress={() => void enableDevices()}
        >
          {busy ? 'Requesting…' : 'Enable camera & mic'}
        </Button>
      ) : (
        <Text fontSize={13} fontWeight="600" color={coworkUi.success}>
          Ready for meetings
        </Text>
      )}
    </YStack>
  )
}

function PermissionChip({ kind, state }: { kind: string; state: PermissionState }) {
  const { ui: coworkUi } = useCoWorkTheme()
  const label =
    state === 'granted'
      ? 'Ready'
      : state === 'denied'
        ? 'Blocked'
        : state === 'prompt'
          ? 'Needed'
          : 'Checking'
  const color =
    state === 'granted'
      ? coworkUi.success
      : state === 'denied'
        ? coworkUi.danger
        : coworkUi.textMuted

  return (
    <XStack
      gap={8}
      alignItems="center"
      paddingHorizontal={12}
      paddingVertical={8}
      borderRadius={999}
      borderWidth={1}
      borderColor={coworkUi.borderSoft}
      backgroundColor={coworkUi.surfaceMuted}
    >
      {kind === 'Camera' ? (
        <Icons.Video size={14} color={color} />
      ) : (
        <Icons.Mic size={14} color={color} />
      )}
      <Text fontSize={12} fontWeight="700" color={color}>
        {kind}: {label}
      </Text>
    </XStack>
  )
}

function mapWebState(state?: PermissionState | string | null): PermissionState {
  if (state === 'granted' || state === 'denied' || state === 'prompt') return state
  return 'unknown'
}
