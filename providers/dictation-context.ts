import { createContext, useContext } from 'react'

export type DictationTarget = {
  id: string
  getValue: () => string
  setValue: (text: string) => void
  /** Password / OTP fields must never receive dictation. */
  secure?: boolean
}

export type DictationContextValue = {
  supported: boolean
  listening: boolean
  error: string | null
  interim: string
  /** Focused field id, if any. */
  focusedId: string | null
  start: () => Promise<void>
  stop: () => Promise<void>
  toggle: () => Promise<void>
  clearError: () => void
  focusTarget: (target: DictationTarget) => void
  blurTarget: (id: string) => void
}

export const DictationContext = createContext<DictationContextValue | null>(null)

export function useDictation() {
  const ctx = useContext(DictationContext)
  if (!ctx) {
    throw new Error('useDictation must be used within DictationProvider')
  }
  return ctx
}

/** Safe when a tree might render outside the provider. */
export function useDictationOptional() {
  return useContext(DictationContext)
}
