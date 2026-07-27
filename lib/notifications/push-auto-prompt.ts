import {
  readPersistentValue,
  writePersistentValue,
} from '~/lib/platform/storage'

/**
 * Persists after the user has *actually decided* the OS permission
 * (granted or denied) — not merely after we attempted to show a dialog.
 * Bumped to v4 to recover devices stuck on earlier “prompted without dialog” bugs.
 */
const STORAGE_KEY = 'sheconomy:push-permission-decided-v4'

type PushPermissionMemory = {
  /** User/OS permission is settled (not still "default"). */
  decided: boolean
}

async function readState(): Promise<PushPermissionMemory> {
  const raw = await readPersistentValue(STORAGE_KEY)
  if (!raw) return { decided: false }
  try {
    const parsed = JSON.parse(raw) as Partial<PushPermissionMemory>
    return { decided: parsed.decided === true }
  } catch {
    return { decided: false }
  }
}

/** True until the user has completed (or OS has settled) the permission choice. */
export async function shouldAutoPromptPush(): Promise<boolean> {
  const state = await readState()
  return !state.decided
}

/** Call only after permission is granted or permanently denied (not still promptable). */
export async function markPushPermissionDecided(): Promise<void> {
  await writePersistentValue(
    STORAGE_KEY,
    JSON.stringify({ decided: true } satisfies PushPermissionMemory),
  )
}

/** Settings → Enable can clear this so we may request again when the OS allows. */
export async function resetPushPermissionMemory(): Promise<void> {
  await writePersistentValue(
    STORAGE_KEY,
    JSON.stringify({ decided: false } satisfies PushPermissionMemory),
  )
}

/** @deprecated Use markPushPermissionDecided */
export const markPushAutoPromptAttempted = markPushPermissionDecided
/** @deprecated Use resetPushPermissionMemory */
export const resetPushAutoPromptDenial = resetPushPermissionMemory
