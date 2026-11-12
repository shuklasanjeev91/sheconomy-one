import type { ComponentType, ReactElement } from 'react'

type IconProps = {
  size?: number | string
  color?: string
  strokeWidth?: number
  [key: string]: unknown
}

const REACT_FORWARD_REF = Symbol.for('react.forward_ref')
const REACT_MEMO = Symbol.for('react.memo')
const REACT_LAZY = Symbol.for('react.lazy')

function isRenderableComponent(value: unknown): value is ComponentType<IconProps> {
  if (typeof value === 'function') return true
  if (typeof value !== 'object' || value == null || !('$$typeof' in value)) return false
  const kind = (value as { $$typeof: symbol }).$$typeof
  return kind === REACT_FORWARD_REF || kind === REACT_MEMO || kind === REACT_LAZY
}

/**
 * Never render an undefined Lucide/`Icons.*` export.
 * Missing tree-shaken icons crash React with minified error #130.
 */
export function SafeIcon({
  icon: Icon,
  fallback = null,
  ...props
}: {
  icon?: ComponentType<IconProps> | null
  fallback?: ReactElement | null
} & IconProps) {
  if (!isRenderableComponent(Icon)) return fallback
  return <Icon {...props} />
}
