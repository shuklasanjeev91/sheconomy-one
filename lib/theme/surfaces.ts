import { Platform } from 'react-native'

import { getShadowStyle, webShadows } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'

/** Shared elevated card surface — theme-aware border, radius, and shadow. */
export function elevatedCardStyle(ui: AppUiTokens, size: 'sm' | 'md' = 'sm') {
  return {
    backgroundColor: ui.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ui.borderSubtle,
    ...(Platform.OS === 'web'
      ? { boxShadow: size === 'md' ? webShadows.md : webShadows.sm }
      : getShadowStyle(size)),
  } as const
}

/** Froststed app chrome (headers, tab bars) — blur on web, solid on native. */
export function chromeSurfaceStyle(ui: AppUiTokens) {
  return Platform.select({
    web: {
      backgroundColor: ui.chromeBg,
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderColor: ui.borderSubtle,
    },
    default: {
      backgroundColor: ui.surface,
      borderColor: ui.border,
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
  } as const
}

/** Interactive list-row hover surface. */
export function interactiveRowStyle(ui: AppUiTokens) {
  return {
    borderRadius: 12,
    hoverStyle: { backgroundColor: ui.navHover },
    pressStyle: { backgroundColor: ui.chipHover, scale: 0.995 },
  } as const
}
