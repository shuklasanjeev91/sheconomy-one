import type { ReactNode } from 'react'

/** Web always runs the latest deploy, so there is no store version to gate on. */
export function ForceUpdateGate({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export default ForceUpdateGate
