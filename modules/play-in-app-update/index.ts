import { requireOptionalNativeModule } from 'expo'

export type ImmediateUpdateResult = 'accepted' | 'cancelled' | 'failed' | 'unavailable'

type PlayInAppUpdateNativeModule = {
  startImmediateUpdate(): Promise<ImmediateUpdateResult>
}

/** Null on iOS and on Android binaries built before this module existed. */
export default requireOptionalNativeModule<PlayInAppUpdateNativeModule>('PlayInAppUpdate')
