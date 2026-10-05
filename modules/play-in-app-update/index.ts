import { requireOptionalNativeModule } from 'expo'

export type ImmediateUpdateResult = 'accepted' | 'cancelled' | 'failed' | 'unavailable'

export type InstalledVersion = { versionName: string | null; versionCode: string }

type PlayInAppUpdateNativeModule = {
  startImmediateUpdate(): Promise<ImmediateUpdateResult>
  getInstalledVersion(): InstalledVersion | null
}

/** Null on iOS and on Android binaries built before this module existed. */
export default requireOptionalNativeModule<PlayInAppUpdateNativeModule>('PlayInAppUpdate')
