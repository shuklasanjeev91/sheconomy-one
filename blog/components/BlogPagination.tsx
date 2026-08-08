import { Button, Icons, Text, XStack } from '~/components/ui'
import type { CmsPaginationMeta } from '~/lib/cms'
import { useAppUi } from '~/lib/theme/useAppUi'

function pageNumbers(current: number, total: number): Array<number | '...'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: Array<number | '...'> = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('...')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('...')
  pages.push(total)
  return pages
}

export function BlogPagination({
  meta,
  onPageChange,
}: {
  meta: CmsPaginationMeta
  onPageChange: (page: number) => void
}) {
  const ui = useAppUi()
  if (!meta || meta.totalPages <= 1) return null

  const pages = pageNumbers(meta.page, meta.totalPages)

  return (
    <XStack alignItems="center" justifyContent="center" gap="$2" flexWrap="wrap">
      <Button
        size="$3"
        tone="outline"
        icon={Icons.ChevronLeft}
        disabled={!meta.hasPrevPage}
        onPress={() => onPageChange(meta.page - 1)}
      >
        Previous
      </Button>
      {pages.map((p, i) =>
        p === '...' ? (
          <Text key={`e-${i}`} color={ui.textMuted} paddingHorizontal="$1">
            …
          </Text>
        ) : (
          <Button
            key={p}
            size="$3"
            tone={p === meta.page ? 'primary' : 'outline'}
            onPress={() => onPageChange(p)}
            minWidth={40}
          >
            {String(p)}
          </Button>
        ),
      )}
      <Button
        size="$3"
        tone="outline"
        iconAfter={Icons.ChevronRight}
        disabled={!meta.hasNextPage}
        onPress={() => onPageChange(meta.page + 1)}
      >
        Next
      </Button>
    </XStack>
  )
}
