import type { ComponentType, ReactElement } from 'react'

type IconProps = {
  size?: number | string
  color?: string
  strokeWidth?: number
  [key: string]: unknown
}

/**
 * Never render an undefined Lucide/`Icons.*` export.
 * Missing tree-shaken icons crash React with minified error #130
 * ("Element type is invalid … got: undefined").
 *
 * Prefer the Icons Proxy in `Icons.tsx` for new code; SafeIcon remains for
 * call sites that pass an icon component reference (e.g. `icon={Icons.X}`).
 */
export function SafeIcon({
  icon: Icon,
  fallback = null,
  ...props
}: {
  icon?: ComponentType<IconProps> | null
  fallback?: ReactElement | null
} & IconProps) {
  // Lucide/Tamagui icons are often forwardRef objects, not plain functions.
  if (Icon == null) return fallback
  return <Icon {...props} />
}
