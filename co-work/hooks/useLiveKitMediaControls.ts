/**
 * Platform builds resolve `useLiveKitMediaControls.web.ts` / `.native.tsx` first.
 * This base file is the web/SSR fallback when only the bare path is resolved.
 */
export { useLiveKitMediaControls } from '~/co-work/hooks/useLiveKitMediaControls.web'

/** Native-only UI — no-op on web so accidental native imports do not crash. */
export function NativeScreenCapturePicker() {
  return null
}
