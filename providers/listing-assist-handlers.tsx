import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'

import type { ListingAssistHandlers } from '~/lib/ai/assist-actions'

type ListingAssistHandlersContextValue = {
  register: (handlers: ListingAssistHandlers | null) => void
  get: () => ListingAssistHandlers | null
}

const ListingAssistHandlersContext = createContext<ListingAssistHandlersContextValue | null>(null)

/** Lets the open listing register cart / follow / message handlers for SHERPA. */
export function ListingAssistHandlersProvider({ children }: { children: ReactNode }) {
  const ref = useRef<ListingAssistHandlers | null>(null)
  const register = useCallback((handlers: ListingAssistHandlers | null) => {
    ref.current = handlers
  }, [])
  const get = useCallback(() => ref.current, [])
  const value = useMemo(() => ({ register, get }), [register, get])
  return (
    <ListingAssistHandlersContext.Provider value={value}>
      {children}
    </ListingAssistHandlersContext.Provider>
  )
}

export function useListingAssistHandlersRegistry() {
  const ctx = useContext(ListingAssistHandlersContext)
  if (!ctx) {
    throw new Error('useListingAssistHandlersRegistry must be used within ListingAssistHandlersProvider')
  }
  return ctx
}

export function useListingAssistHandlersOptional() {
  return useContext(ListingAssistHandlersContext)
}
