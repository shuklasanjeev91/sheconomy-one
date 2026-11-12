import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { usePathname } from 'one'

import { AiAssistSheet } from '~/components/ai/AiAssistSheet'
import { YStack } from '~/components/ui'
import { resolveAiRouteContext } from '~/lib/ai'

import {
  AiAssistContext,
  type AiAssistContextValue,
  type OpenAssistOptions,
} from '~/providers/ai-assist-context'

/** App-wide SHERPA assistant host. Hooks live in `ai-assist-context` for Fast Refresh. */
export function AiAssistProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'
  const routeContext = useMemo(() => resolveAiRouteContext(pathname), [pathname])

  const [open, setOpen] = useState(false)
  const [override, setOverride] = useState<OpenAssistOptions | null>(null)
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null)
  const [autoSendPrompt, setAutoSendPrompt] = useState(false)

  const openAssist = useCallback((options?: OpenAssistOptions) => {
    setOverride(options ?? null)
    setDraftPrompt(options?.prompt?.trim() || null)
    setAutoSendPrompt(Boolean(options?.autoSend && options?.prompt?.trim()))
    setOpen(true)
  }, [])

  const closeAssist = useCallback(() => {
    setOpen(false)
    setAutoSendPrompt(false)
  }, [])

  const clearDraft = useCallback(() => {
    setDraftPrompt(null)
    setAutoSendPrompt(false)
  }, [])

  const value = useMemo<AiAssistContextValue>(
    () => ({
      open,
      routeContext,
      openAssist,
      closeAssist,
      draftPrompt,
      autoSendPrompt,
      override,
      clearDraft,
    }),
    [
      open,
      routeContext,
      openAssist,
      closeAssist,
      draftPrompt,
      autoSendPrompt,
      override,
      clearDraft,
    ],
  )

  return (
    <AiAssistContext.Provider value={value}>
      <YStack flex={1} width="100%" position="relative">
        {children}
        <AiAssistSheet />
      </YStack>
    </AiAssistContext.Provider>
  )
}
