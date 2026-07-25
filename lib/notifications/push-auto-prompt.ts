import {
  readPersistentValue,
  writePersistentValue,
} from '~/lib/platform/storage'

/** Bumped so devices stuck on the old "denied forever" gate get one fresh auto-subscribe pass. */
const STORAGE_KEY = 'sheconomy:push-auto-prompt-v2'

type PushAutoPromptState = {
  /** OS permission prompt was shown at least once on this device. */
  prompted: boolean
}

const DEFAULT_STATE: PushAutoPromptState = { prompted: false }

async function readState(): Promise<PushAutoPromptState> {
  const raw = await readPersistentValue(STORAGE_KEY)
  if (!raw) return DEFAULT_STATE
  try {
    const parsed = JSON.parse(raw) as Partial<PushAutoPromptState>
    return {
      prompted: parsed.prompted === true,
    }
  } catch {
    return DEFAULT_STATE
  }
}

/** Whether we should auto-request the OS permission dialog (once per install). */
export async function shouldAutoPromptPush(): Promise<boolean> {
  const state = await readState()
  return !state.prompted
}

export async function markPushAutoPromptAttempted(): Promise<void> {
  await writePersistentValue(
    STORAGE_KEY,
    JSON.stringify({ prompted: true } satisfies PushAutoPromptState),
  )
}

/** Clear so Settings → enable can re-run the full subscribe flow. */
export async function resetPushAutoPromptDenial(): Promise<void> {
  await writePersistentValue(
    STORAGE_KEY,
    JSON.stringify({ prompted: false } satisfies PushAutoPromptState),
  )
}
