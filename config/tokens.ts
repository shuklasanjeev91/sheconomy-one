/**
 * App-level design tokens that sit *on top of* Tamagui's own token system
 * (color/space/size/radius/zIndex — see `tamagui.config.ts`).
 *
 * Tamagui's tokens cover primitives; these cover the couple of things
 * every "premium" UI kit needs that aren't 1:1 style props — named radius
 * aliases and cross-platform shadow presets (RN needs shadowColor/Offset/
 * Opacity/Radius + elevation, web wants boxShadow — Tamagui's `shadow*`
 * shorthands don't unify the two, so we do it once, here).
 */
import { isWeb } from 'tamagui'

import { brandColors } from './brand-colors'

export const BRAND_THEME = 'sheconomy' as const

export { BRAND_NAME, BRAND_MEMBER_LABEL, BRAND_SHOP_LABEL, BRAND_COWORK_LABEL } from './brand'

/**
 * Tamagui's own `radius` token scale (`$1`…`$12`, see tamagui.config.ts)
 * already covers 0–50px — use those directly (e.g. `borderRadius="$6"`) for
 * anything that scales with component size. `pill` is the one shape that
 * scale can't express (a numeric radius large enough to always be fully
 * round regardless of height), so it lives here instead.
 */
export const radius = {
  pill: 999,
  /** Standard cards, tiles, panels */
  card: 16,
  /** Modals, sheets, hero blocks */
  surface: 20,
  /** Compact chips, tags */
  chip: 10,
} as const

type ShadowPreset = {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

const shadow = (
  height: number,
  radiusPx: number,
  opacity: number,
  elevation: number
): ShadowPreset => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height },
  shadowOpacity: opacity,
  shadowRadius: radiusPx,
  elevation,
})

/** Elevation scale: sm (subtle, cards) → lg (floating, sheets/dialogs) */
export const shadows = {
  none: shadow(0, 0, 0, 0),
  sm: shadow(1, 3, 0.06, 1),
  md: shadow(4, 12, 0.1, 4),
  lg: shadow(10, 24, 0.14, 10),
  xl: shadow(20, 40, 0.18, 16),
} satisfies Record<string, ShadowPreset>

/** Web renders real box-shadows via CSS; RN needs the shadow* props above. */
export const webShadows = {
  none: 'none',
  sm: '0 1px 2px rgba(208, 16, 96, 0.04), 0 2px 10px rgba(16, 12, 14, 0.05)',
  md: '0 4px 20px rgba(208, 16, 96, 0.07), 0 1px 4px rgba(16, 12, 14, 0.06)',
  lg: '0 12px 36px rgba(208, 16, 96, 0.1), 0 4px 12px rgba(16, 12, 14, 0.07)',
  xl: '0 24px 56px rgba(208, 16, 96, 0.12), 0 8px 20px rgba(16, 12, 14, 0.09)',
} as const

/**
 * A handful of Tamagui's compound sub-components (Dialog.Content,
 * Popover.Content, Switch, Checkbox, ListItem, ToggleGroup.Item, etc.) have
 * public prop types that don't include `animation`/`enterStyle`/`exitStyle`
 * even though they fully support them at runtime — this is a known typing
 * gap in some Tamagui component packages. Spreading through here (an `any`)
 * opts those specific keys out of the overly-strict excess-property check
 * without loosening anything else in the surrounding styled() call.
 */
export function looseStyle(style: Record<string, unknown>): any {
  return style
}

export type ShadowSize = keyof typeof shadows

/** Spread this onto any Tamagui view/stack for a cross-platform elevation. */
export function getShadowStyle(size: ShadowSize) {
  return isWeb ? { boxShadow: webShadows[size] } : shadows[size]
}

/** Brand gradient stops, used by <BrandGradient /> and hero/marketing surfaces. */
export const gradients = {
  brand: [brandColors.primary, brandColors.coral],
  brandSubtle: [brandColors.roseTint, brandColors.roseSurface],
  success: ['$green8', '$green10'],
  warning: ['$yellow8', '$yellow10'],
  danger: ['$red8', '$red10'],
} as const

export { brandColors } from './brand-colors'
