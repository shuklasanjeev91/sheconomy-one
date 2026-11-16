import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import { usePathname } from 'one'

import { AiAssistSheet } from '~/components/ai/AiAssistSheet'
import { YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { resolveAiRouteContext } from '~/lib/ai'

import {
  AiAssistContext,
  type AiAssistContextValue,
  type OpenAssistOptions,
} from '~/providers/ai-assist-context'

/** App-wide SHERPA assistant host. Hooks live in `ai-assist-context` for Fast Refresh. */
export function AiAssistProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'
  const { isDesktopWeb } = useAppLayout()
  const documentScroll = Platform.OS === 'web' && isDesktopWeb
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
      <YStack
        flex={documentScroll ? undefined : 1}
        flexGrow={documentScroll ? 1 : undefined}
        flexShrink={documentScroll ? 0 : undefined}
        width="100%"
        position="relative"
        style={documentScroll ? ({ flex: '1 0 auto', minHeight: '100dvh' } as const) : undefined}
      >
        {children}
        <AiAssistSheet />
      </YStack>
    </AiAssistContext.Provider>
  )
}
