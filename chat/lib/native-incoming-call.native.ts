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

async function ensureSetup(): Promise<boolean> {
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
            // Extra key read by scripts/patch-callkeep-fgs-notification.cjs
            ...({
              notificationText: 'A call is active. Tap to return to SHEconomy.',
            } as Record<string, string>),
          },
        },
      })

      if (Platform.OS === 'android') {
        RNCallKeep.setAvailable(true)
        RNCallKeep.registerAndroidEvents()
      }

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
 * Initialize CallKit (iOS) / ConnectionService (Android) and wire answer/decline.
 * Returns an unsubscribe that removes listeners (does not tear down CallKeep).
 */
export async function setupNativeIncomingCalls(
  nextHandlers?: NativeIncomingCallHandlers,
): Promise<() => void> {
  if (nextHandlers) handlers = nextHandlers

  // Defer CallKit / ConnectionService init until after first paint so cold
  // start does not race Hermes GC (Release launch crashes on large bundles).
  // Setup alone does NOT start an Android FGS — that begins only when
  // displayIncomingCall / outgoing ConnectionService connections are created.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 1_500)
  })
  await ensureSetup()

  const onAnswer = ({ callUUID }: { callUUID: string }) => {
    const id = normalizeUuid(callUUID)
    try {
      if (Platform.OS === 'android') {
        RNCallKeep.backToForeground()
        RNCallKeep.setCurrentCallActive(id)
      }
    } catch {
      // ignore
    }
    handlers.onAnswer?.(id)
  }

  const onEnd = ({ callUUID }: { callUUID: string }) => {
    const id = normalizeUuid(callUUID)
    activeUuids.delete(id)
    handlers.onDecline?.(id)
  }

  const onShowUi = ({ callUUID }: { callUUID: string }) => {
    // Self-managed Android: native system UI may not appear; keep JS overlay as UI.
    // CallKeep still owns telecom session state for audio focus.
    void callUUID
  }

  RNCallKeep.addEventListener('answerCall', onAnswer)
  RNCallKeep.addEventListener('endCall', onEnd)
  RNCallKeep.addEventListener('showIncomingCallUi', onShowUi)

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
    RNCallKeep.removeEventListener('showIncomingCallUi')
  }
}

/** Show the system incoming-call UI (CallKit / ConnectionService). */
export function displayNativeIncomingCall(info: NativeIncomingCallInfo): void {
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
  const uuid = normalizeUuid(callId)
  if (!uuid) return
  try {
    if (Platform.OS === 'android') {
      RNCallKeep.setCurrentCallActive(uuid)
    }
    RNCallKeep.answerIncomingCall(uuid)
  } catch {
    // ignore
  }
}
