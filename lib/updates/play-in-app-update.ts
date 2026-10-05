import type { ImmediateUpdateResult } from '~/modules/play-in-app-update'

/** Web has no Play in-app updates. */
export async function startPlayImmediateUpdate(): Promise<ImmediateUpdateResult> {
  return 'unavailable'
}
