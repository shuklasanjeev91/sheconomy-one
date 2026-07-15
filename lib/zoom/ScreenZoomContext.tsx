import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  SCREEN_ZOOM_MAX,
  SCREEN_ZOOM_MIN,
  SCREEN_ZOOM_STEP,
  SCREEN_ZOOM_STORAGE_KEY,
  clampZoom,
  formatZoomPercent,
} from '~/lib/zoom/zoom-levels'

function applyWebDocumentZoom(scale: number) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return
  const root = document.documentElement
  if (scale === 1) root.style.removeProperty('zoom')
  else root.style.setProperty('zoom', String(scale))
}

async function readPersistedScale(): Promise<number> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(SCREEN_ZOOM_STORAGE_KEY)
      if (!raw) return 1
      return clampZoom(Number(raw) || 1, SCREEN_ZOOM_MIN, SCREEN_ZOOM_MAX)
    }
    const raw = await AsyncStorage.getItem(SCREEN_ZOOM_STORAGE_KEY)
    if (!raw) return 1
    return clampZoom(Number(raw) || 1, SCREEN_ZOOM_MIN, SCREEN_ZOOM_MAX)
  } catch {
    return 1
  }
}

async function persistScale(scale: number) {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(SCREEN_ZOOM_STORAGE_KEY, String(scale))
      return
    }
    await AsyncStorage.setItem(SCREEN_ZOOM_STORAGE_KEY, String(scale))
  } catch {
    /* ignore */
  }
}

type ScreenZoomContextValue = {
  scale: number
  percentLabel: string
  canZoomIn: boolean
  canZoomOut: boolean
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  setScale: (scale: number) => void
}

const ScreenZoomContext = createContext<ScreenZoomContextValue | null>(null)

/**
 * App-wide content zoom — scales the whole UI so every word/image grows together.
 * Web uses CSS `zoom` (sharp text). Native uses layout-aware transform.
 */
export function ScreenZoomProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState(1)

  useEffect(() => {
    void readPersistedScale().then((next) => {
      setScaleState(next)
      applyWebDocumentZoom(next)
    })
  }, [])

  const setScale = useCallback((next: number) => {
    const clamped = clampZoom(
      Math.round(next * 100) / 100,
      SCREEN_ZOOM_MIN,
      SCREEN_ZOOM_MAX,
    )
    setScaleState(clamped)
    void persistScale(clamped)
    applyWebDocumentZoom(clamped)
  }, [])

  useEffect(() => {
    applyWebDocumentZoom(scale)
  }, [scale])

  const zoomIn = useCallback(() => {
    setScale(scale + SCREEN_ZOOM_STEP)
  }, [scale, setScale])

  const zoomOut = useCallback(() => {
    setScale(scale - SCREEN_ZOOM_STEP)
  }, [scale, setScale])

  const reset = useCallback(() => setScale(1), [setScale])

  const value = useMemo<ScreenZoomContextValue>(
    () => ({
      scale,
      percentLabel: formatZoomPercent(scale),
      canZoomIn: scale < SCREEN_ZOOM_MAX - 0.001,
      canZoomOut: scale > SCREEN_ZOOM_MIN + 0.001,
      zoomIn,
      zoomOut,
      reset,
      setScale,
    }),
    [scale, zoomIn, zoomOut, reset, setScale],
  )

  return <ScreenZoomContext.Provider value={value}>{children}</ScreenZoomContext.Provider>
}

export function useScreenZoom() {
  const ctx = useContext(ScreenZoomContext)
  if (!ctx) {
    throw new Error('useScreenZoom must be used within ScreenZoomProvider')
  }
  return ctx
}

/** Optional: doesn't throw when provider is missing (e.g. tests). */
export function useScreenZoomOptional() {
  return useContext(ScreenZoomContext)
}
