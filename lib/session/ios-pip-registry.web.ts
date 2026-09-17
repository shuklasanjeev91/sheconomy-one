/** Web/Android stub — iOS PiP registry lives in the same path on native builds. */

type PipRef = { current: unknown }

export function registerIosPipVideoRef(_ref: PipRef | null): void {}

export function getIosPipVideoRef(): PipRef | null {
  return null
}

export async function startRegisteredIosPip(): Promise<void> {
  throw new Error('Picture-in-Picture requires iOS 15+ with an active video tile.')
}

export async function stopRegisteredIosPip(): Promise<void> {}
