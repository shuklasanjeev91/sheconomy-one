import { stripHtml } from '~/lib/cms'

export function estimateReadTime(body = ''): number {
  const wordCount = stripHtml(body).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(wordCount / 200))
}

export function formatCount(count = 0): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return String(count)
}

export function formatBlogDate(
  value: string | null | undefined,
  style: 'short' | 'long' = 'short',
): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    ...(style === 'long' ? { weekday: 'long' as const } : {}),
  })
}

export function getTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export const BLOG_SORT_OPTIONS = [
  { value: 'published_at:desc', label: 'Newest First' },
  { value: 'published_at:asc', label: 'Oldest First' },
  { value: 'view_count:desc', label: 'Most Viewed' },
  { value: 'like_count:desc', label: 'Most Liked' },
  { value: 'created_at:desc', label: 'Recently Added' },
] as const

export type BlogSortValue = (typeof BLOG_SORT_OPTIONS)[number]['value']

export function parseBlogSort(sort: string): {
  order_by: 'published_at' | 'view_count' | 'like_count' | 'created_at' | 'updated_at'
  ascending: boolean
} {
  const [field, dir] = sort.split(':')
  const allowed = ['published_at', 'view_count', 'like_count', 'created_at', 'updated_at'] as const
  const order_by = (allowed as readonly string[]).includes(field)
    ? (field as (typeof allowed)[number])
    : 'published_at'
  return { order_by, ascending: dir === 'asc' }
}
