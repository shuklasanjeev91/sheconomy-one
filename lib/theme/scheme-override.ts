import { createContext, createElement, useContext, type ReactNode } from 'react'
import { Theme, useThemeName } from 'tamagui'

export type ColorScheme = 'light' | 'dark'

const ForcedSchemeContext = createContext<ColorScheme | null>(null)

/**
 * Pin a subtree to one color scheme regardless of the user's theme.
 *
 * Tamagui's nested `<Theme>` alone is not enough: async meeting chunks can end
 * up with a duplicated `@tamagui/core`, so `useThemeName()` there falls back to
 * the root scheme after the first render. JS token hooks read this context.
 */
export function ForcedScheme({ scheme, children }: { scheme: ColorScheme; children: ReactNode }) {
  return createElement(
    ForcedSchemeContext.Provider,
    { value: scheme },
    createElement(Theme, { name: scheme }, children),
  )
}

export function useForcedScheme(): ColorScheme | null {
  return useContext(ForcedSchemeContext)
}

export function useResolvedScheme(): ColorScheme {
  const forced = useContext(ForcedSchemeContext)
  const themeName = useThemeName()
  if (forced) return forced
  return themeName === 'dark' ? 'dark' : 'light'
}
