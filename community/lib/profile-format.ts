const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

function parseYearMonth(value: string | null | undefined): { year: number; month?: number } | null {
  if (!value) return null

  const iso = value.match(/^(\d{4})-(\d{2})/)
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]) }
  }

  const yearOnly = value.match(/^(\d{4})$/)
  if (yearOnly) {
    return { year: Number(yearOnly[1]) }
  }

  const parsed = Date.parse(value)
  if (!Number.isNaN(parsed)) {
    const date = new Date(parsed)
    return { year: date.getFullYear(), month: date.getMonth() + 1 }
  }

  return null
}

export function formatExperienceDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  isCurrent?: boolean | null,
) {
  const start = parseYearMonth(startDate)
  const end = parseYearMonth(endDate)

  const startLabel = start
    ? start.month
      ? `${MONTH_NAMES[start.month - 1]} ${start.year}`
      : `${start.year}`
    : null

  const endLabel = isCurrent
    ? 'Present'
    : end
      ? end.month
        ? `${MONTH_NAMES[end.month - 1]} ${end.year}`
        : `${end.year}`
      : null

  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`
  if (startLabel) return startLabel
  if (endLabel) return endLabel
  return null
}

export function formatEducationYearRange(
  startYear: number | null | undefined,
  endYear: number | null | undefined,
) {
  if (startYear && endYear) return `${startYear} – ${endYear}`
  if (startYear) return `${startYear} – Present`
  if (endYear) return `${endYear}`
  return null
}

export function parseSkillTags(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function formatDurationMonths(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  isCurrent?: boolean | null,
) {
  const start = parseYearMonth(startDate)
  if (!start) return null

  const end = isCurrent
    ? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }
    : parseYearMonth(endDate)

  if (!end) return null

  const startMonths = start.year * 12 + (start.month ?? 1)
  const endMonths = end.year * 12 + (end.month ?? 12)
  const total = Math.max(1, endMonths - startMonths + 1)

  const years = Math.floor(total / 12)
  const months = total % 12

  if (years > 0 && months > 0) return `${years} yr${years === 1 ? '' : 's'} ${months} mo`
  if (years > 0) return `${years} yr${years === 1 ? '' : 's'}`
  return `${months} mo`
}
