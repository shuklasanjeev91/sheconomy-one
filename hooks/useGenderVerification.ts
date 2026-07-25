// Platform builds resolve `useGenderVerification.native.ts` / `useGenderVerification.web.ts` first.
// This file is the web/SSR fallback when only the base path is resolved.
export { useGenderVerification } from '~/hooks/useGenderVerification.web'
