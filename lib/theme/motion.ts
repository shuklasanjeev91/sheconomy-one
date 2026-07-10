/**
 * Shared Tamagui motion presets — use with `animation`, `hoverStyle`, `pressStyle`, `enterStyle`.
 * Pairs with animations from `@tamagui/config` (`quick`, `smooth`, `bouncy`, etc.).
 */
export const motion = {
  /** Standard tap feedback for cards and list rows. */
  pressable: {
    animation: 'quick' as const,
    cursor: 'pointer' as const,
    hoverStyle: { y: -2, opacity: 0.96 },
    pressStyle: { scale: 0.985, y: 0, opacity: 0.92 },
  },
  /** Subtle lift on hover for commerce tiles. */
  cardLift: {
    animation: 'smooth' as const,
    cursor: 'pointer' as const,
    hoverStyle: { y: -3, opacity: 0.97 },
    pressStyle: { scale: 0.98, y: 0 },
  },
  /** Gentle fade-up when a surface mounts (web + native CSS driver). */
  fadeUp: {
    animation: 'smooth' as const,
    enterStyle: { opacity: 0, y: 10 },
    opacity: 1,
    y: 0,
  },
  /** Quick opacity fade for overlays and chips. */
  fadeIn: {
    animation: 'quick' as const,
    enterStyle: { opacity: 0 },
    opacity: 1,
  },
  /** Bouncy feedback for favorites, toggles, icon buttons. */
  springTap: {
    animation: 'bouncy' as const,
    pressStyle: { scale: 0.88 },
  },
} as const
