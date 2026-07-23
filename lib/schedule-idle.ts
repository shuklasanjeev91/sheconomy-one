import { Platform } from 'react-native'

/** Run work after first paint / idle — keeps secondary widgets off the critical path. */
export function scheduleIdle(run: () => void, timeoutMs = 2500): () => void {
  let cancelled = false
  const safeRun = () => {
    if (!cancelled) run()
  }

  let rafId: number | null = null
  let idleId: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = () => {
    cancelled = true
    if (rafId != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafId)
    }
    if (idleId != null && typeof window !== 'undefined') {
      const w = window as Window & { cancelIdleCallback?: (id: number) => void }
      w.cancelIdleCallback?.(idleId)
    }
    if (timer != null) clearTimeout(timer)
  }

  if (typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(() => {
      if (cancelled) return
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const w = window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        }
        if (typeof w.requestIdleCallback === 'function') {
          idleId = w.requestIdleCallback(safeRun, { timeout: timeoutMs })
          return
        }
      }
      timer = setTimeout(safeRun, 300)
    })
    return clear
  }

  timer = setTimeout(safeRun, 300)
  return clear
}
