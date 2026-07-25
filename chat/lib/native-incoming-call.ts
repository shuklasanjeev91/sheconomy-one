/**
 * Web stub — system CallKit / ConnectionService is native-only.
 * Metro resolves `native-incoming-call.native.ts` on iOS/Android.
 */

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

export async function setupNativeIncomingCalls(
  _handlers?: NativeIncomingCallHandlers,
): Promise<() => void> {
  return () => {}
}

export function displayNativeIncomingCall(_info: NativeIncomingCallInfo): void {}

export function endNativeIncomingCall(_callId: string): void {}

export function markNativeIncomingCallActive(_callId: string): void {}
