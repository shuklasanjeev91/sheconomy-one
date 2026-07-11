/** Chat timestamp helpers, locale-aware and cross-platform. */

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const DAY_MS = 24 * 60 * 60 * 1000

function clockTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Short time shown on list rows + message bubbles ("9:41 AM", "Yesterday", "Mon", "12/03/24"). */
export function formatListTimestamp(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  if (sameDay(date, now)) return clockTime(date)

  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'short' })

  return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/** Clock time under a message bubble. */
export function formatBubbleTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return clockTime(date)
}

/** Sticky day separator label ("Today", "Yesterday", "Monday, 3 March"). */
export function formatDaySeparator(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  if (sameDay(date, now)) return 'Today'

  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Presence subtitle ("online", "last seen today at 9:41 AM"). */
export function formatLastSeen(isOnline: boolean, lastSeen: string | null): string {
  if (isOnline) return 'online'
  if (!lastSeen) return ''
  const date = new Date(lastSeen)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  if (sameDay(date, now)) return `last seen today at ${clockTime(date)}`

  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS)
  if (diffDays === 1) return `last seen yesterday at ${clockTime(date)}`

  return `last seen ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
}

/** Returns true when two messages are far enough apart in time to warrant a day divider. */
export function isNewDay(prev: string | null, current: string): boolean {
  if (!prev) return true
  const a = new Date(prev)
  const b = new Date(current)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false
  return !sameDay(a, b)
}
