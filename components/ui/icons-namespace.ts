/**
 * App-wide Lucide icon namespace.
 *
 * Rolldown emits icon re-exports as lazy getters (`() => ActualIcon`). We resolve
 * those to real components (forwardRef / memo / function) and Proxy any missing
 * name to a no-op so checkout cannot crash with React #130.
 *
 * File is intentionally not named Icons.tsx — on macOS that collides with icons.ts.
 */
import type { ComponentType } from 'react'
import * as LucideIcons from '~/components/ui/icons'
import type { IconProps } from '~/components/ui/icons'

function MissingIcon(_props: IconProps) {
  return null
}

const REACT_ELEMENT = Symbol.for('react.element')
const REACT_FORWARD_REF = Symbol.for('react.forward_ref')
const REACT_MEMO = Symbol.for('react.memo')
const REACT_LAZY = Symbol.for('react.lazy')

function isRenderableComponent(value: unknown): value is ComponentType<IconProps> {
  if (typeof value === 'function') return true
  if (typeof value !== 'object' || value == null || !('$$typeof' in value)) return false
  const kind = (value as { $$typeof: symbol }).$$typeof
  if (kind === REACT_ELEMENT) return false
  return kind === REACT_FORWARD_REF || kind === REACT_MEMO || kind === REACT_LAZY
}

/** Unwrap Rolldown lazy re-export thunks: `() => ActualIcon`. */
function resolveIcon(value: unknown): ComponentType<IconProps> | null {
  if (value == null) return null

  if (typeof value === 'function') {
    // Prefer treating it as a component. Only unwrap 0-arg thunks when the
    // result is a real component type — never when it's a React element.
    if (value.length === 0) {
      try {
        const inner = (value as () => unknown)()
        if (inner != null && inner !== value && isRenderableComponent(inner)) {
          return inner
        }
      } catch {
        /* keep function as component */
      }
    }
    return value as ComponentType<IconProps>
  }

  if (isRenderableComponent(value)) return value
  return null
}

const iconsTable: Record<string, ComponentType<IconProps>> = {}
for (const key of Object.keys(LucideIcons)) {
  if (key === '__esModule' || key === 'default') continue
  const resolved = resolveIcon((LucideIcons as Record<string, unknown>)[key])
  if (resolved) iconsTable[key] = resolved
}

export const Icons = new Proxy(iconsTable, {
  get(target, prop, receiver) {
    if (typeof prop === 'symbol') {
      return Reflect.get(target, prop, receiver)
    }
    const resolved = resolveIcon(Reflect.get(target, prop, receiver))
    if (resolved == null) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(`[Icons] Missing or unresolved icon: ${String(prop)}`)
      }
      return MissingIcon
    }
    return resolved
  },
}) as typeof LucideIcons
