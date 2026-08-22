import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  FOR_YOU_VISIBLE_CAP,
  selectVisibleForYouSlots,
  type ForYouSlotId,
  type ForYouSlotState,
} from '~/community/lib/for-you-density'
import { YStack } from '~/components/ui'

type SlotMap = Partial<Record<ForYouSlotId, boolean>>

type ForYouSlotsContextValue = {
  register: (id: ForYouSlotId, hasContent: boolean) => void
  unregister: (id: ForYouSlotId) => void
  showAll: boolean
  density: ReturnType<typeof selectVisibleForYouSlots>
  contentCount: number
  overflowCount: number
}

const ForYouSlotsContext = createContext<ForYouSlotsContextValue | null>(null)
const ForYouSlotIdContext = createContext<ForYouSlotId | null>(null)

export function ForYouSlotsProvider({
  children,
  showAll,
  maxVisible = FOR_YOU_VISIBLE_CAP,
}: {
  children: ReactNode
  showAll: boolean
  maxVisible?: number
}) {
  const [states, setStates] = useState<SlotMap>({})

  const register = useCallback((id: ForYouSlotId, hasContent: boolean) => {
    setStates((prev) => {
      if (prev[id] === hasContent) return prev
      return { ...prev, [id]: hasContent }
    })
  }, [])

  const unregister = useCallback((id: ForYouSlotId) => {
    setStates((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const slotList = useMemo<ForYouSlotState[]>(
    () =>
      (Object.entries(states) as [ForYouSlotId, boolean][]).map(([id, hasContent]) => ({
        id,
        hasContent,
      })),
    [states],
  )

  const density = useMemo(
    () => selectVisibleForYouSlots(slotList, { maxVisible }),
    [slotList, maxVisible],
  )

  const value = useMemo(
    () => ({
      register,
      unregister,
      showAll,
      density,
      contentCount: density.contentIds.length,
      overflowCount: density.overflowIds.length,
    }),
    [register, unregister, showAll, density],
  )

  return <ForYouSlotsContext.Provider value={value}>{children}</ForYouSlotsContext.Provider>
}

export function useForYouSlots() {
  const ctx = useContext(ForYouSlotsContext)
  if (!ctx) {
    throw new Error('useForYouSlots must be used inside ForYouSlotsProvider')
  }
  return ctx
}

export function useForYouSlotsOptional() {
  return useContext(ForYouSlotsContext)
}

/**
 * Report whether this strip currently has content to show.
 * Safe no-op outside the For you hub.
 */
export function useReportForYouContent(hasContent: boolean) {
  const slots = useForYouSlotsOptional()
  const slotId = useContext(ForYouSlotIdContext)

  useEffect(() => {
    if (!slots || !slotId) return
    slots.register(slotId, hasContent)
  }, [slots, slotId, hasContent])

  useEffect(() => {
    if (!slots || !slotId) return
    return () => slots.unregister(slotId)
  }, [slots, slotId])
}

type ForYouSlotProps = {
  id: ForYouSlotId
  children: ReactNode
}

/**
 * Wraps one For you strip. Children stay mounted so data hooks stay warm;
 * layout is hidden unless the strip has content and is in the visible set
 * (or See all is on).
 */
export function ForYouSlot({ id, children }: ForYouSlotProps) {
  const slots = useForYouSlotsOptional()

  const shouldDisplay =
    !slots ||
    ((slots.showAll || slots.density.visibleIds.includes(id)) &&
      slots.density.contentIds.includes(id))

  return (
    <ForYouSlotIdContext.Provider value={id}>
      <YStack width="100%" display={shouldDisplay ? 'flex' : 'none'}>
        {children}
      </YStack>
    </ForYouSlotIdContext.Provider>
  )
}
