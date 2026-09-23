import type { ComponentProps } from 'react'

/**
 * Hermes-safe Pressable for production (vxrn) bundles.
 *
 * `import { Pressable } from 'react-native'` is compiled to
 * `__toESM(require_react_native(), 1).Pressable`, which drops RN’s lazy
 * getters and crashes InstantMeeting with:
 *   Property 'Pressable' doesn't exist
 *
 * Reading Pressable off the raw CommonJS export keeps the getter.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactNative = require('react-native') as typeof import('react-native')

export const RnPressable = ReactNative.Pressable
export type RnPressableProps = ComponentProps<typeof ReactNative.Pressable>
