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

  // Honor short timeouts immediately after the next frame (infinite-scroll prefetch).
  const delayMs = Math.max(0, timeoutMs)

  if (typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(() => {
      if (cancelled) return
      if (Platform.OS === 'web' && typeof window !== 'undefined' && delayMs >= 500) {
        const w = window as Window & {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
        }
        if (typeof w.requestIdleCallback === 'function') {
          idleId = w.requestIdleCallback(safeRun, { timeout: delayMs })
          return
        }
      }
      timer = setTimeout(safeRun, Math.min(delayMs, 300))
    })
    return clear
  }

  timer = setTimeout(safeRun, Math.min(delayMs, 300))
  return clear
}
