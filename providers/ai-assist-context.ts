import { createContext, useContext } from 'react'

import type { AiContext, AiProduct, AiRouteContext } from '~/lib/ai'

export type OpenAssistOptions = {
  product?: AiProduct
  contextPage?: string
  context?: AiContext
  /** Pre-fill composer and optionally auto-send. */
  prompt?: string
  autoSend?: boolean
}

export type AiAssistContextValue = {
  open: boolean
  routeContext: AiRouteContext
  openAssist: (options?: OpenAssistOptions) => void
  closeAssist: () => void
  draftPrompt: string | null
  autoSendPrompt: boolean
  override: OpenAssistOptions | null
  clearDraft: () => void
}

export const AiAssistContext = createContext<AiAssistContextValue | null>(null)

export function useAiAssist() {
  const ctx = useContext(AiAssistContext)
  if (!ctx) {
    throw new Error('useAiAssist must be used within AiAssistProvider')
  }
  return ctx
}

/** Safe optional access when a tree might render outside the provider. */
export function useAiAssistOptional() {
  return useContext(AiAssistContext)
}
