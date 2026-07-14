import AsyncStorage from '@react-native-async-storage/async-storage'

import { UPDATE_METADATA_STORAGE_KEY } from '~/lib/updates/constants'
import type { UpdateMetadata } from '~/lib/updates/types'

export const EMPTY_UPDATE_METADATA: UpdateMetadata = {
  lastAppliedUpdateId: null,
  lastCheckAt: null,
  lastAttemptAt: null,
  lastFailureAt: null,
  lastFailureMessage: null,
  dismissedUpdateId: null,
  reloadGuardUpdateId: null,
  reloadGuardCount: 0,
}

export async function readUpdateMetadata(): Promise<UpdateMetadata> {
  try {
    const raw = await AsyncStorage.getItem(UPDATE_METADATA_STORAGE_KEY)
    if (!raw) return { ...EMPTY_UPDATE_METADATA }
    const parsed = JSON.parse(raw) as Partial<UpdateMetadata>
    return {
      ...EMPTY_UPDATE_METADATA,
      ...parsed,
      reloadGuardCount: Number(parsed.reloadGuardCount ?? 0) || 0,
    }
  } catch {
    return { ...EMPTY_UPDATE_METADATA }
  }
}

export async function writeUpdateMetadata(
  patch: Partial<UpdateMetadata>,
): Promise<UpdateMetadata> {
  const current = await readUpdateMetadata()
  const next: UpdateMetadata = { ...current, ...patch }
  try {
    await AsyncStorage.setItem(UPDATE_METADATA_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Keep the in-memory next value even if persistence fails.
  }
  return next
}
