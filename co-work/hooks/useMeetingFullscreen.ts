// Platform builds resolve `useMeetingFullscreen.native.ts` / `.web.ts` first.
// This file is the web/SSR fallback when only the base path is resolved.
export { useMeetingFullscreen } from '~/co-work/hooks/useMeetingFullscreen.web'
