// Each file is a small, self-contained `@font-face { font-family: 'Inter' }`
// rule with the woff2 inlined as base64 — Vite bundles these as regular CSS,
// so the browser (and even prerendered SSR output) gets real `Inter` text
// with zero extra JS, no `expo-font` web/SSR bridge, and no async gate needed.
// Only the weights our UI kit actually uses (400 body, 600/700 our
// components + Tamagui's heading font) are loaded to keep the bundle lean.
import '@tamagui/font-inter/css/400.css'
import '@tamagui/font-inter/css/600.css'
import '@tamagui/font-inter/css/700.css'

export function useAppFonts(): [boolean] {
  return [true]
}
