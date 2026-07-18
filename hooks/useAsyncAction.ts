import { useCallback, useMemo, useState } from 'react'

import { useAppToast } from '~/components/ui'
import { createAsyncActionLock } from '~/lib/async/async-action-lock'
import { feedback } from '~/lib/platform/feedback'

type AsyncActionOptions = {
  /** Shown when the action throws without a message. */
  errorTitle?: string
  successTitle?: string
  successMessage?: string
  haptic?: 'success' | 'selection' | 'warning' | 'destructive' | false
  onError?: (error: unknown) => void
}

/**
 * Duplicate-proof async action helper — disables while pending and normalizes
 * failure toasts. Safe to wire directly to button `onPress` handlers.
 */
export function useAsyncAction() {
  const toast = useAppToast()
  const [pending, setPending] = useState(false)
  const lock = useMemo(() => createAsyncActionLock(), [])

  const run = useCallback(
    async <T,>(action: () => Promise<T>, opts: AsyncActionOptions = {}): Promise<T | undefined> => {
      return lock.run(async () => {
        setPending(true)
        try {
          const value = await action()
          if (opts.haptic !== false) {
            void feedback(opts.haptic ?? 'success')
          }
          if (opts.successTitle) {
            toast.show(opts.successTitle, {
              tone: 'success',
              message: opts.successMessage,
            })
          }
          return value
        } catch (error) {
          if (opts.haptic !== false) {
            void feedback('warning')
          }
          opts.onError?.(error)
          const message = error instanceof Error ? error.message : String(error)
          toast.show(opts.errorTitle ?? 'Something went wrong', {
            tone: 'danger',
            message: message || undefined,
          })
          return undefined as T
        } finally {
          setPending(false)
        }
      })
    },
    [lock, toast],
  )

  return { run, pending, disabled: pending }
}
