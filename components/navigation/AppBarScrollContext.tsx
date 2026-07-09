import { createContext, useContext, useMemo, useState } from 'react'

type AppBarScrollContextValue = {
  scrollY: number
  setScrollY: (y: number) => void
}

const AppBarScrollContext = createContext<AppBarScrollContextValue | null>(null)

const noop = () => {}

export function AppBarScrollProvider({ children }: { children: React.ReactNode }) {
  const [scrollY, setScrollY] = useState(0)
  const value = useMemo(() => ({ scrollY, setScrollY }), [scrollY])

  return (
    <AppBarScrollContext.Provider value={value}>{children}</AppBarScrollContext.Provider>
  )
}

export function useAppBarScroll() {
  const context = useContext(AppBarScrollContext)
  if (!context) {
    return { scrollY: 0, setScrollY: noop }
  }
  return context
}