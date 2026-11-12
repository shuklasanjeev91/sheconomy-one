/**
 * App-wide Lucide icon namespace.
 *
 * Rolldown emits icon re-exports as lazy thunks (`() => ActualIcon`). Spreading
 * that namespace into a plain object kept the thunks — React then tried to
 * render the thunk (or its return value) and crashed with minified #130
 * ("Element type is invalid … got: undefined") on checkout SectionCards.
 *
 * We unwrap thunks into real components, then Proxy any still-missing name to a
 * no-op so checkout cannot crash on a bad icon lookup.
 *
 * File is intentionally not named Icons.tsx — on macOS that collides with icons.ts.
 */
import type { ComponentType } from 'react'
import * as LucideIcons from '~/components/ui/icons'
import type { IconProps } from '~/components/ui/icons'

function MissingIcon(_props: IconProps) {
  return null
}

function isReactComponentType(value: unknown): value is ComponentType<IconProps> {
  if (value == null) return false
  if (typeof value === 'function') return true
  if (typeof value === 'object' && value !== null && '$$typeof' in value) return true
  return false
}

/** Unwrap Rolldown/Vite lazy re-export thunks: `() => ActualIcon`. */
function resolveIcon(value: unknown): ComponentType<IconProps> | null {
  if (!isReactComponentType(value)) return null
  if (typeof value === 'function' && value.length === 0) {
    try {
      const inner = (value as () => unknown)()
      if (inner != null && inner !== value && isReactComponentType(inner)) {
        return inner
      }
    } catch {
      /* use value as-is */
    }
  }
  return value
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
