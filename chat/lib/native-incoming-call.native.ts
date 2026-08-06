import { Platform } from 'react-native'
import RNCallKeep, { CONSTANTS as CK_CONSTANTS } from '@livekit/react-native-callkeep'

export type NativeIncomingCallInfo = {
  callId: string
  callerName: string
  hasVideo: boolean
  handle?: string
}

export type NativeIncomingCallHandlers = {
  onAnswer?: (callId: string) => void
  onDecline?: (callId: string) => void
}

let setupPromise: Promise<boolean> | null = null
let handlers: NativeIncomingCallHandlers = {}
const activeUuids = new Set<string>()

function normalizeUuid(callId: string): string {
  return callId.trim().toLowerCase()
}

/**
 * Android: CallKeep ConnectionService uses phoneCall/microphone FGS types that
 * Google Play rejected for this marketplace app. Use the in-app IncomingCallHost
 * overlay + push notifications instead (no native telecom FGS).
 */
function androidCallKeepDisabled(): boolean {
  return Platform.OS === 'android'
}

async function ensureSetup(): Promise<boolean> {
  if (androidCallKeepDisabled()) return false
  if (setupPromise) return setupPromise

  setupPromise = (async () => {
    try {
      const ok = await RNCallKeep.setup({
        ios: {
          appName: 'SHEconomy',
          supportsVideo: true,
          maximumCallGroups: '1',
          maximumCallsPerCallGroup: '1',
          includesCallsInRecents: false,
        },
        android: {
          alertTitle: 'Phone account permission',
          alertDescription:
            'SHEconomy needs permission to show incoming voice and video calls on your lock screen.',
          cancelButton: 'Cancel',
          okButton: 'OK',
          additionalPermissions: [],
          selfManaged: true,
          foregroundService: {
            channelId: 'com.sheconomy.ecommerce.calls',
            channelName: 'SHEconomy calls',
            notificationTitle: 'SHEconomy call in progress',
            ...({
              notificationText: 'A call is active. Tap to return to SHEconomy.',
            } as Record<string, string>),
          },
        },
      })

      return !!ok
    } catch (error) {
      console.warn('[calls] CallKeep setup failed', error)
      setupPromise = null
      return false
    }
  })()

  return setupPromise
}

/**
 * Initialize CallKit (iOS). Android is a no-op — in-app overlay handles UI.
 * Returns an unsubscribe that removes listeners (does not tear down CallKeep).
 */
export async function setupNativeIncomingCalls(
  nextHandlers?: NativeIncomingCallHandlers,
): Promise<() => void> {
  if (nextHandlers) handlers = nextHandlers

  if (androidCallKeepDisabled()) {
    return () => {}
  }

  // Defer CallKit init until after first paint so cold start does not race
  // Hermes GC (Release launch crashes on large bundles).
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 1_500)
  })
  await ensureSetup()

  const onAnswer = ({ callUUID }: { callUUID: string }) => {
    const id = normalizeUuid(callUUID)
    handlers.onAnswer?.(id)
  }

  const onEnd = ({ callUUID }: { callUUID: string }) => {
    const id = normalizeUuid(callUUID)
    activeUuids.delete(id)
    handlers.onDecline?.(id)
  }

  // iOS CallKit: answerCall / endCall only.
  // Do NOT register `showIncomingCallUi` — that event is Android self-managed only and
  // throws "RNCallKeepShowIncomingCallUi is not a supported event type" on iOS.
  RNCallKeep.addEventListener('answerCall', onAnswer)
  RNCallKeep.addEventListener('endCall', onEnd)

  try {
    const initial = await RNCallKeep.getInitialEvents()
    for (const event of initial ?? []) {
      if (event.name === 'RNCallKeepPerformAnswerCallAction' && event.data?.callUUID) {
        onAnswer({ callUUID: String(event.data.callUUID) })
      } else if (event.name === 'RNCallKeepPerformEndCallAction' && event.data?.callUUID) {
        onEnd({ callUUID: String(event.data.callUUID) })
      }
    }
    RNCallKeep.clearInitialEvents()
  } catch {
    // ignore
  }

  return () => {
    RNCallKeep.removeEventListener('answerCall')
    RNCallKeep.removeEventListener('endCall')
  }
}

/** Show the system incoming-call UI (CallKit on iOS). No-op on Android. */
export function displayNativeIncomingCall(info: NativeIncomingCallInfo): void {
  if (androidCallKeepDisabled()) return

  const uuid = normalizeUuid(info.callId)
  if (!uuid || activeUuids.has(uuid)) return

  void ensureSetup().then((ok) => {
    if (!ok) return
    try {
      activeUuids.add(uuid)
      RNCallKeep.displayIncomingCall(
        uuid,
        info.handle ?? info.callerName,
        info.callerName,
        'generic',
        info.hasVideo,
      )
    } catch (error) {
      activeUuids.delete(uuid)
      console.warn('[calls] displayIncomingCall failed', error)
    }
  })
}

export function endNativeIncomingCall(callId: string): void {
  if (androidCallKeepDisabled()) return

  const uuid = normalizeUuid(callId)
  if (!uuid) return
  activeUuids.delete(uuid)
  try {
    RNCallKeep.endCall(uuid)
  } catch {
    try {
      RNCallKeep.reportEndCallWithUUID(uuid, CK_CONSTANTS.END_CALL_REASONS.REMOTE_ENDED)
    } catch {
      // ignore
    }
  }
}

export function markNativeIncomingCallActive(callId: string): void {
  if (androidCallKeepDisabled()) return

  const uuid = normalizeUuid(callId)
  if (!uuid) return
  try {
    RNCallKeep.answerIncomingCall(uuid)
  } catch {
    // ignore
  }
}
