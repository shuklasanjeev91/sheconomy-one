import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'one'

import { AiAssistFab } from '~/components/ai/AiAssistFab'
import { AiAssistSheet } from '~/components/ai/AiAssistSheet'
import { YStack } from '~/components/ui'
import { resolveAiRouteContext } from '~/lib/ai'
import type { AiContext, AiProduct, AiRouteContext } from '~/lib/ai'
import { useSupabase } from '~/providers/SupabaseProvider'

type OpenAssistOptions = {
  product?: AiProduct
  contextPage?: string
  context?: AiContext
  /** Pre-fill composer and optionally auto-send. */
  prompt?: string
  autoSend?: boolean
}

type AiAssistContextValue = {
  open: boolean
  routeContext: AiRouteContext
  openAssist: (options?: OpenAssistOptions) => void
  closeAssist: () => void
  draftPrompt: string | null
  autoSendPrompt: boolean
  override: OpenAssistOptions | null
  clearDraft: () => void
}

const AiAssistContext = createContext<AiAssistContextValue | null>(null)

export function AiAssistProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabase()
  const pathname = usePathname() ?? '/'
  const routeContext = useMemo(() => resolveAiRouteContext(pathname), [pathname])

  const [open, setOpen] = useState(false)
  const [override, setOverride] = useState<OpenAssistOptions | null>(null)
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null)
  const [autoSendPrompt, setAutoSendPrompt] = useState(false)

  const openAssist = useCallback((options?: OpenAssistOptions) => {
    if (!user) return
    setOverride(options ?? null)
    setDraftPrompt(options?.prompt?.trim() || null)
    setAutoSendPrompt(Boolean(options?.autoSend && options?.prompt?.trim()))
    setOpen(true)
  }, [user])

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
        {user ? (
          <>
            <AiAssistFab />
            <AiAssistSheet />
          </>
        ) : null}
      </YStack>
    </AiAssistContext.Provider>
  )
}

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
