import { Platform } from 'react-native'

import PlayInAppUpdate, { type ImmediateUpdateResult } from '~/modules/play-in-app-update'
import { logUpdate } from '~/lib/updates/logging'

/** Start Google Play's full-screen in-app update; 'unavailable' when Play can't. */
export async function startPlayImmediateUpdate(): Promise<ImmediateUpdateResult> {
  if (Platform.OS !== 'android' || !PlayInAppUpdate) return 'unavailable'
  try {
    const result = await PlayInAppUpdate.startImmediateUpdate()
    logUpdate('info', 'Play in-app update result', result)
    return result
  } catch (error) {
    logUpdate('warn', 'Play in-app update failed', error)
    return 'failed'
  }
}
