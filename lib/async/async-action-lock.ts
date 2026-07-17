/**
 * Duplicate-proof async runner used by `useAsyncAction` and unit tests.
 */
export function createAsyncActionLock() {
  let pending = false

  return {
    get pending() {
      return pending
    },
    async run<T>(action: () => Promise<T>): Promise<T | undefined> {
      if (pending) return undefined
      pending = true
      try {
        return await action()
      } finally {
        pending = false
      }
    },
  }
}
