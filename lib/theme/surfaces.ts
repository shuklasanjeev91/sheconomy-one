import { Platform } from 'react-native'

import { getShadowStyle, radius, webShadows, webShadowsDark, type ColorScheme } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'

/** Shared elevated card surface — theme-aware border, radius, and shadow. */
export function elevatedCardStyle(
  ui: AppUiTokens,
  size: 'sm' | 'md' = 'sm',
  scheme: ColorScheme = 'light',
) {
  const isDark = scheme === 'dark'
  return {
    backgroundColor: ui.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: ui.borderSubtle,
    ...(Platform.OS === 'web'
      ? { boxShadow: isDark ? webShadowsDark[size] : webShadows[size] }
      : getShadowStyle(size, scheme)),
  } as const
}

/** Frosted app chrome (headers, tab bars) — blur on web, elevated surface on native. */
export function chromeSurfaceStyle(ui: AppUiTokens) {
  return Platform.select({
    web: {
      backgroundColor: ui.chromeBg,
      backdropFilter: 'blur(24px) saturate(200%)',
      WebkitBackdropFilter: 'blur(24px) saturate(200%)',
      borderColor: ui.borderSubtle,
    },
    default: {
      backgroundColor: ui.elevatedSurface,
      borderColor: ui.borderSubtle,
      ...getShadowStyle('sm'),
    },
  })
}

/** Full-width mobile bottom tab dock — native app chrome. */
export function mobileTabBarDockStyle(ui: AppUiTokens, options?: { dark?: boolean; surface?: string }) {
  const bg = options?.surface ?? ui.chromeBg
  return Platform.select({
    web: {
      width: '100%',
      maxWidth: '100vw',
      backgroundColor: bg,
      backdropFilter: 'blur(28px) saturate(210%)',
      WebkitBackdropFilter: 'blur(28px) saturate(210%)',
      borderTopWidth: 1,
      borderTopColor: ui.borderSubtle,
      boxShadow: options?.dark
        ? '0 -8px 32px rgba(0, 0, 0, 0.35)'
        : '0 -4px 24px rgba(16, 12, 14, 0.07)',
    },
    default: {
      width: '100%',
      backgroundColor: options?.surface ?? ui.elevatedSurface,
      borderTopWidth: 1,
      borderTopColor: ui.borderSubtle,
      ...getShadowStyle('sm'),
    },
  })
}

/** Pill-shaped search / filter field background. */
export function searchFieldStyle(ui: AppUiTokens) {
  return {
    backgroundColor: ui.surfaceMuted,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ui.borderSubtle,
    ...(Platform.OS === 'web'
      ? {
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }
      : {}),
  } as const
}

/**
 * Etsy-style omnibox shell — white pill, strong border, brand CTA slot.
 * Use with an overflow:hidden parent and a flush search button on the right.
 */
export function etsySearchFieldStyle(ui: AppUiTokens, focused?: boolean) {
  return {
    backgroundColor: ui.surface,
    borderRadius: 999,
    borderWidth: focused ? 2 : 2,
    borderColor: focused ? ui.brand : ui.inputBorder,
    overflow: 'hidden' as const,
    ...(Platform.OS === 'web'
      ? {
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: focused ? `0 0 0 3px ${ui.focusRing}` : '0 1px 2px rgba(16, 12, 14, 0.04)',
        }
      : {}),
  } as const
}

/** Focus ring for inline search inputs on native + web. */
export function searchFieldFocusStyle(ui: AppUiTokens) {
  return Platform.select({
    web: {
      borderColor: ui.brand,
      boxShadow: `0 0 0 3px ${ui.focusRing}`,
    },
    default: {
      borderColor: ui.brand,
      borderWidth: 1.5,
    },
  })
}

/** Interactive list-row hover surface. */
export function interactiveRowStyle(ui: AppUiTokens) {
  return {
    borderRadius: 12,
    hoverStyle: { backgroundColor: ui.navHover },
    pressStyle: { backgroundColor: ui.chipHover, scale: 0.995 },
  } as const
}
