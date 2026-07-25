// Platform builds resolve `useAppFonts.native.ts` / `useAppFonts.web.ts` first.
// This file is the web/SSR fallback when only the base path is resolved.
export { useAppFonts } from '~/hooks/useAppFonts.web'
