import { useEffect, useMemo, useState } from 'react'

import {
  Badge,
  Button,
  Field,
  Icons,
  Input,
  Spinner,
  Text,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  deleteComment,
  loadComments,
  moderateComment,
  type CmsCommentWithAuthor,
} from '~/lib/cms'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CmsInlineConfirm, CmsPageShell, CmsPanel, CmsPickerSelect } from './CmsPageShell'

type StatusFilter = 'all' | 'pending' | 'approved' | 'flagged'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'flagged', label: 'Flagged' },
]

function commentTone(row: CmsCommentWithAuthor) {
  if (row.is_flagged) return 'warning' as const
  if (row.is_approved) return 'success' as const
  return 'neutral' as const
}

function commentStatusLabel(row: CmsCommentWithAuthor) {
  if (row.is_flagged) return 'Flagged'
  if (row.is_approved) return 'Approved'
  return 'Pending'
}

export function AdminCmsCommentsPage() {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  const { comments, commentMeta, isFetching, isUpdating, isDeleting, commentError } =
    useAppSelector((s) => s.cms)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [pendingDelete, setPendingDelete] = useState<CmsCommentWithAuthor | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void dispatch(loadComments({ page: 1, limit: 20 }))
  }, [dispatch])

  function refresh(overrides: { page?: number } = {}) {
    const params: Record<string, unknown> = {
      page: overrides.page ?? 1,
      limit: 20,
      search: search.trim() || undefined,
    }
    if (status === 'pending') {
      params.is_approved = false
      params.is_flagged = false
    } else if (status === 'approved') {
      params.is_approved = true
    } else if (status === 'flagged') {
      params.is_flagged = true
    }
    void dispatch(loadComments(params))
  }

  async function handleApprove(row: CmsCommentWithAuthor) {
    setBusyId(row.id)
    try {
      await dispatch(
        moderateComment({ id: row.id, payload: { is_approved: true, is_flagged: false } }),
      ).unwrap()
      toast.show('Comment approved', { tone: 'success' })
      refresh({ page: commentMeta.page })
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Failed to approve', { tone: 'danger' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleFlag(row: CmsCommentWithAuthor) {
    setBusyId(row.id)
    try {
      await dispatch(
        moderateComment({ id: row.id, payload: { is_flagged: true, is_approved: false } }),
      ).unwrap()
      toast.show('Comment flagged', { tone: 'success' })
      refresh({ page: commentMeta.page })
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Failed to flag', { tone: 'danger' })
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    try {
      await dispatch(deleteComment(pendingDelete.id)).unwrap()
      toast.show('Comment deleted', { tone: 'success' })
      setPendingDelete(null)
      refresh({ page: 1 })
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Delete failed', { tone: 'danger' })
    } finally {
      setBusyId(null)
    }
  }

  const emptyHint = useMemo(() => {
    if (status !== 'all') return 'Try changing the status filter.'
    return 'Comments will appear here once users post on content.'
  }, [status])

  return (
    <CmsPageShell
      title="Comments"
      subtitle="Moderate blog comments across all content."
    >
      <CmsPanel>
        <XStack gap="$2" flexWrap="wrap" alignItems="flex-end">
          <Field label="Search" flex={1} minWidth={200}>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search comment body…"
              onSubmitEditing={() => refresh({ page: 1 })}
            />
          </Field>
          <Field label="Status" minWidth={isDesktop ? 160 : '100%'}>
            <CmsPickerSelect
              value={status}
              options={STATUS_OPTIONS}
              placeholder="Status"
              onValueChange={(v) => setStatus(v as StatusFilter)}
            />
          </Field>
          <Button size="$3" onPress={() => refresh({ page: 1 })}>
            Apply
          </Button>
        </XStack>
      </CmsPanel>

      {pendingDelete ? (
        <CmsInlineConfirm
          title="Delete comment?"
          description="This comment will be permanently removed."
          confirmLabel="Delete"
          loading={isDeleting || busyId === pendingDelete.id}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      {commentError ? <Text color={ui.error}>{commentError}</Text> : null}

      <CmsPanel gap="$2">
        {isFetching && comments.length === 0 ? (
          <YStack minHeight={200} alignItems="center" justifyContent="center" gap="$2">
            <Spinner size="large" />
            <Text color={ui.textMuted}>Loading comments…</Text>
          </YStack>
        ) : comments.length === 0 ? (
          <YStack minHeight={160} alignItems="center" justifyContent="center" gap="$1">
            <Text fontWeight="700" color={ui.text}>
              No comments found
            </Text>
            <Text color={ui.textMuted}>{emptyHint}</Text>
          </YStack>
        ) : (
          comments.map((row) => (
            <YStack
              key={row.id}
              gap="$2"
              padding="$3"
              borderRadius={12}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
            >
              <XStack gap="$2" flexWrap="wrap" alignItems="center">
                <Badge tone={commentTone(row)}>{commentStatusLabel(row)}</Badge>
                <Text fontSize={12} color={ui.textMuted}>
                  {row.author?.full_name || row.author?.username || 'Anonymous'}
                </Text>
                <Text fontSize={12} color={ui.textMuted}>
                  · content {row.content_id.slice(0, 8)}…
                </Text>
              </XStack>
              <Text color={ui.text}>{row.body}</Text>
              <XStack gap="$2" flexWrap="wrap">
                {!row.is_approved ? (
                  <Button
                    size="$2"
                    icon={Icons.Check}
                    disabled={busyId === row.id || isUpdating}
                    onPress={() => void handleApprove(row)}
                  >
                    Approve
                  </Button>
                ) : null}
                {!row.is_flagged ? (
                  <Button
                    size="$2"
                    tone="outline"
                    icon={Icons.Flag}
                    disabled={busyId === row.id || isUpdating}
                    onPress={() => void handleFlag(row)}
                  >
                    Flag
                  </Button>
                ) : null}
                <Button
                  size="$2"
                  tone="outline"
                  disabled={busyId === row.id}
                  onPress={() => setPendingDelete(row)}
                >
                  Delete
                </Button>
              </XStack>
            </YStack>
          ))
        )}

        {commentMeta.totalPages > 1 ? (
          <XStack justifyContent="space-between" alignItems="center" paddingTop="$2">
            <Text fontSize={13} color={ui.textMuted}>
              Page {commentMeta.page} of {commentMeta.totalPages} · {commentMeta.total} items
            </Text>
            <XStack gap="$2">
              <Button
                size="$2"
                tone="outline"
                disabled={!commentMeta.hasPrevPage || isFetching}
                onPress={() => refresh({ page: commentMeta.page - 1 })}
              >
                Previous
              </Button>
              <Button
                size="$2"
                tone="outline"
                disabled={!commentMeta.hasNextPage || isFetching}
                onPress={() => refresh({ page: commentMeta.page + 1 })}
              >
                Next
              </Button>
            </XStack>
          </XStack>
        ) : null}
      </CmsPanel>
    </CmsPageShell>
  )
}
