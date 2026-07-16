import {
  readPersistentValue,
  writePersistentValue,
} from '~/lib/platform/storage'

const STORAGE_KEY = 'sheconomy:push-auto-prompt-v1'

type PushAutoPromptState = {
  /** OS permission prompt was shown at least once on this device. */
  prompted: boolean
  /** User denied push — do not auto-prompt again. */
  denied: boolean
}

const DEFAULT_STATE: PushAutoPromptState = { prompted: false, denied: false }

async function readState(): Promise<PushAutoPromptState> {
  const raw = await readPersistentValue(STORAGE_KEY)
  if (!raw) return DEFAULT_STATE
  try {
    const parsed = JSON.parse(raw) as Partial<PushAutoPromptState>
    return {
      prompted: parsed.prompted === true,
      denied: parsed.denied === true,
    }
  } catch {
    return DEFAULT_STATE
  }
}

/** Whether we should show the native OS permission dialog automatically. */
export async function shouldAutoPromptPush(): Promise<boolean> {
  const state = await readState()
  return !state.prompted && !state.denied
}

export async function markPushAutoPromptAttempted(granted: boolean): Promise<void> {
  const state = await readState()
  await writePersistentValue(
    STORAGE_KEY,
    JSON.stringify({
      prompted: true,
      denied: granted ? false : true,
    } satisfies PushAutoPromptState),
  )
}

/** Clear denial so settings can re-trigger a prompt attempt. */
export async function resetPushAutoPromptDenial(): Promise<void> {
  const state = await readState()
  await writePersistentValue(
    STORAGE_KEY,
    JSON.stringify({ prompted: state.prompted, denied: false }),
  )
}
