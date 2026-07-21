import { useEffect, useState, type ReactNode } from 'react'

import { scheduleIdle } from '~/lib/schedule-idle'

/** Mount children after idle so first paint stays focused on primary content. */
export function IdleMount({
  children,
  fallback = null,
  timeoutMs = 2500,
}: {
  children: ReactNode
  fallback?: ReactNode
  timeoutMs?: number
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => scheduleIdle(() => setReady(true), timeoutMs), [timeoutMs])

  if (!ready) return <>{fallback}</>
  return <>{children}</>
}
