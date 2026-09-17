import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { ensureMeetingMobilePermissions } from '~/co-work/lib/meeting-media-permissions'
import {
  describeMeetingWebScreenShare,
  detectMeetingWebCapabilities,
  mapWebMediaPermissionError,
  meetingWebJoinBlocker,
  meetingWebUnsupportedMessage,
} from '~/co-work/lib/meeting-web'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { Button, Icons, Text, XStack, YStack } from '~/components/ui'

type PermissionState = 'unknown' | 'granted' | 'denied' | 'prompt'

/**
 * Pre-meeting device readiness — camera, mic, and (native) notifications.
 * Expo Camera / push are loaded only on native so a module failure never blanks Co-Work on web.
 * Permission denial never crashes; the card stays usable for retry.
 */
export function DevicePrepCard() {
  const { ui: coworkUi } = useCoWorkTheme()
  const webCaps = useMemo(
    () => (Platform.OS === 'web' ? detectMeetingWebCapabilities() : null),
    [],
  )
  const [camera, setCamera] = useState<PermissionState>('unknown')
  const [mic, setMic] = useState<PermissionState>('unknown')
  const [notifications, setNotifications] = useState<PermissionState>(
    Platform.OS === 'web' ? 'granted' : 'unknown',
  )
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    void refreshStatus()
  }, [])

  async function refreshStatus() {
    try {
      if (Platform.OS === 'web') {
        const blocker = webCaps ? meetingWebJoinBlocker(webCaps) : null
        if (blocker) {
          setCamera('denied')
          setMic('denied')
          setNotifications('granted')
          setHint(blocker)
          return
        }

        if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
          const [cam, audio] = await Promise.all([
            navigator.permissions.query({ name: 'camera' as PermissionName }).catch(() => null),
            navigator.permissions.query({ name: 'microphone' as PermissionName }).catch(() => null),
          ])
          setCamera(mapWebState(cam?.state))
          setMic(mapWebState(audio?.state))
          setNotifications('granted')
          return
        }

        setCamera('prompt')
        setMic('prompt')
        setNotifications('granted')
        return
      }

      const Camera = (await import('expo-camera')).Camera
      const current = await Camera.getCameraPermissionsAsync()
      setCamera(current.granted ? 'granted' : current.canAskAgain ? 'prompt' : 'denied')
      const micCurrent = await Camera.getMicrophonePermissionsAsync()
      setMic(micCurrent.granted ? 'granted' : micCurrent.canAskAgain ? 'prompt' : 'denied')

      try {
        const push = (await import('~/lib/notifications/push-client')).default
        await push.init()
        const granted = await push.getPermission()
        if (granted) {
          setNotifications('granted')
        } else {
          const canAsk = await push.canRequestPermission().catch(() => true)
          setNotifications(canAsk ? 'prompt' : 'denied')
        }
      } catch {
        setNotifications('unknown')
      }
    } catch {
      setCamera('unknown')
      setMic('unknown')
      setNotifications(Platform.OS === 'web' ? 'granted' : 'unknown')
    }
  }

  async function enableDevices() {
    setBusy(true)
    setHint(null)
    try {
      if (Platform.OS === 'web' && webCaps) {
        const blocker = meetingWebJoinBlocker(webCaps)
        if (blocker) {
          setHint(blocker)
          return
        }
      }
      const result = await ensureMeetingMobilePermissions({ requestNotifications: true })
      setCamera(result.cameraGranted ? 'granted' : 'denied')
      setMic(result.microphoneGranted ? 'granted' : 'denied')
      setNotifications(result.notificationsGranted ? 'granted' : Platform.OS === 'web' ? 'granted' : 'denied')
      if (!result.ok) {
        setHint(result.message ?? mapWebMediaPermissionError('microphone'))
      } else if (result.denials.length > 0) {
        setHint(result.denials.map((d) => d.message).join(' '))
      }
    } catch {
      // Never crash the prep card if a native module misbehaves.
      setHint(
        Platform.OS === 'web'
          ? mapWebMediaPermissionError('microphone')
          : 'Could not update permissions. Open Settings → SHEconomy if access stays blocked.',
      )
    } finally {
      setBusy(false)
      void refreshStatus()
    }
  }

  const needsEnable =
    camera !== 'granted' ||
    mic !== 'granted' ||
    (Platform.OS !== 'web' && notifications !== 'granted')

  const screenShareHint =
    Platform.OS === 'web' && webCaps
      ? webCaps.getDisplayMedia
        ? describeMeetingWebScreenShare(webCaps)
        : meetingWebUnsupportedMessage('screen_share')
      : null

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
        Check camera, microphone
        {Platform.OS === 'web' ? ', and screen sharing' : ', and notifications'} before you join a
        meeting. Denials never crash the app — you can still join with audio if mic is allowed.
      </Text>
      <XStack gap="$3" flexWrap="wrap">
        <PermissionChip kind="Camera" state={camera} />
        <PermissionChip kind="Mic" state={mic} />
        {Platform.OS !== 'web' ? <PermissionChip kind="Alerts" state={notifications} /> : null}
        {Platform.OS === 'web' && webCaps ? (
          <PermissionChip
            kind="Share"
            state={webCaps.getDisplayMedia ? 'granted' : 'denied'}
            readyLabel="Ready"
            deniedLabel="Unsupported"
          />
        ) : null}
        {Platform.OS === 'web' && webCaps ? (
          <PermissionChip
            kind="Devices"
            state={webCaps.enumerateDevices ? 'granted' : 'denied'}
            readyLabel="Ready"
            deniedLabel="Unsupported"
          />
        ) : null}
      </XStack>
      {screenShareHint ? (
        <Text fontSize={12} color={coworkUi.textMuted} lineHeight={17}>
          {screenShareHint}
        </Text>
      ) : null}
      {hint ? (
        <Text fontSize={12} color={coworkUi.warning} lineHeight={17}>
          {hint}
        </Text>
      ) : null}
      {needsEnable ? (
        <Button
          size="$3"
          borderRadius={999}
          backgroundColor={coworkUi.brand}
          color="white"
          disabled={busy}
          onPress={() => void enableDevices()}
        >
          {busy ? 'Requesting…' : Platform.OS === 'web' ? 'Enable camera & mic' : 'Enable permissions'}
        </Button>
      ) : (
        <Text fontSize={13} fontWeight="600" color={coworkUi.success}>
          Ready for meetings
        </Text>
      )}
    </YStack>
  )
}

function PermissionChip({
  kind,
  state,
  readyLabel = 'Ready',
  deniedLabel = 'Blocked',
}: {
  kind: string
  state: PermissionState
  readyLabel?: string
  deniedLabel?: string
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const label =
    state === 'granted'
      ? readyLabel
      : state === 'denied'
        ? deniedLabel
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
      ) : kind === 'Alerts' ? (
        <Icons.Bell size={14} color={color} />
      ) : kind === 'Share' ? (
        <Icons.ScreenShare size={14} color={color} />
      ) : kind === 'Devices' ? (
        <Icons.SlidersHorizontal size={14} color={color} />
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
