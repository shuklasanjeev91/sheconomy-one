/** Stable, readable name colors for group senders — one consistent hue per user. */
const SENDER_COLORS_LIGHT = [
  '#c0398a',
  '#1f7a8c',
  '#b5651d',
  '#6a4c93',
  '#2a9d8f',
  '#c1121f',
  '#3a6ea5',
  '#7b6d28',
]

const SENDER_COLORS_DARK = [
  '#f78fc2',
  '#7fd1e0',
  '#f0b17a',
  '#c3a6e8',
  '#7ee0cf',
  '#ff8f9c',
  '#8fb8ec',
  '#dcd07a',
]

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function getSenderColor(userId: string, isDark: boolean): string {
  const palette = isDark ? SENDER_COLORS_DARK : SENDER_COLORS_LIGHT
  return palette[hash(userId) % palette.length]
}
