import { useCallback, useEffect, useRef, useState } from 'react'

import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
} from '~/lib/drafts/form-draft'

type UseFormDraftOptions<T> = {
  key: string | null
  /** Current form snapshot to persist. */
  value: T
  /** Return false to skip saving empty drafts. */
  isDirty?: (value: T) => boolean
  debounceMs?: number
  version?: number
  enabled?: boolean
  onRestored?: (value: T) => void
}

/**
 * Persist long-form drafts and restore them once on mount.
 */
export function useFormDraft<T>({
  key,
  value,
  isDirty,
  debounceMs = 600,
  version,
  enabled = true,
  onRestored,
}: UseFormDraftOptions<T>) {
  const [restored, setRestored] = useState(false)
  const onRestoredRef = useRef(onRestored)
  onRestoredRef.current = onRestored
  const skipNextSaveRef = useRef(false)

  useEffect(() => {
    if (!enabled || !key) {
      setRestored(true)
      return
    }

    let cancelled = false
    void (async () => {
      const draft = await loadFormDraft<T>(key, { version })
      if (cancelled) return
      if (draft) {
        skipNextSaveRef.current = true
        onRestoredRef.current?.(draft.data)
      }
      setRestored(true)
    })()

    return () => {
      cancelled = true
    }
  }, [enabled, key, version])

  useEffect(() => {
    if (!enabled || !key || !restored) return
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      return
    }
    if (isDirty && !isDirty(value)) {
      void clearFormDraft(key)
      return
    }

    const timer = setTimeout(() => {
      void saveFormDraft(key, value, { version })
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [debounceMs, enabled, isDirty, key, restored, value, version])

  const discard = useCallback(async () => {
    if (!key) return
    await clearFormDraft(key)
  }, [key])

  return { restored, discard }
}
