import { Platform } from 'react-native'

/**
 * Injects a DOM `<style>` tag on web only.
 * Never render raw `<style>` in RN — Hermes treats it as a host component named
 * `style` and crashes with "View config getter callback … received undefined".
 */
export function WebOnlyStyle({ children }: { children: string }) {
  if (Platform.OS !== 'web') return null
  return <style>{children}</style>
}
