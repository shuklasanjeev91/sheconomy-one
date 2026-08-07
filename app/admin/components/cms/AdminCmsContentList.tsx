import { useEffect, useMemo, useState } from 'react'
import { useRouter, type Href } from 'one'

import {
  Badge,
  Button,
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
  archiveContent,
  deleteContent,
  loadCategories,
  loadContents,
  publishContent,
  softDeleteContent,
  type CmsContentDetail,
  type CmsContentStatus,
  type CmsContentType,
} from '~/lib/cms'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import {
  CmsInlineConfirm,
  CmsPageShell,
  CmsPanel,
  CmsPickerSelect,
  cmsEditHref,
} from './CmsPageShell'

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'post', label: 'Post' },
  { value: 'page', label: 'Page' },
  { value: 'product', label: 'Product' },
  { value: 'announcement', label: 'Announcement' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

function statusTone(status: string) {
  if (status === 'published') return 'success' as const
  if (status === 'draft') return 'warning' as const
  if (status === 'scheduled') return 'info' as const
  return 'neutral' as const
}

export function AdminCmsContentList() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  const { items, contentMeta, contentFilters, categories, isFetching, isDeleting, contentError } =
    useAppSelector((s) => s.cms)

  const [search, setSearch] = useState(contentFilters.search ?? '')
  const [type, setType] = useState(contentFilters.type ?? 'all')
  const [status, setStatus] = useState(contentFilters.status ?? 'all')
  const [categoryId, setCategoryId] = useState(contentFilters.category_id ?? 'all')
  const [pendingSoft, setPendingSoft] = useState<CmsContentDetail | null>(null)
  const [pendingHard, setPendingHard] = useState<CmsContentDetail | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void dispatch(loadContents({ page: 1 }))
    void dispatch(loadCategories())
  }, [dispatch])

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All categories' },
      ...categories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  )

  const stats = useMemo(
    () => ({
      total: contentMeta.total,
      published: items.filter((i) => i.status === 'published').length,
      draft: items.filter((i) => i.status === 'draft').length,
      scheduled: items.filter((i) => i.status === 'scheduled').length,
      views: items.reduce((sum, i) => sum + (i.view_count ?? 0), 0),
      comments: items.reduce((sum, i) => sum + (i.comment_count ?? 0), 0),
    }),
    [contentMeta.total, items],
  )

  function refresh(overrides: Record<string, unknown> = {}) {
    void dispatch(
      loadContents({
        page: 1,
        search: search.trim() || undefined,
        type: type === 'all' ? undefined : (type as CmsContentType),
        status: status === 'all' ? undefined : (status as CmsContentStatus),
        category_id: categoryId === 'all' ? undefined : categoryId,
        ...overrides,
      }),
    )
  }

  async function handlePublish(item: CmsContentDetail) {
    setBusyId(item.id)
    try {
      await dispatch(publishContent({ id: item.id })).unwrap()
      toast.show('Published', { tone: 'success' })
      refresh({ page: contentMeta.page })
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Failed to publish', { tone: 'danger' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleArchive(item: CmsContentDetail) {
    setBusyId(item.id)
    try {
      await dispatch(archiveContent(item.id)).unwrap()
      toast.show('Archived', { tone: 'success' })
      refresh({ page: contentMeta.page })
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Failed to archive', { tone: 'danger' })
    } finally {
      setBusyId(null)
    }
  }

  async function confirmSoftDelete() {
    if (!pendingSoft) return
    setBusyId(pendingSoft.id)
    try {
      await dispatch(softDeleteContent(pendingSoft.id)).unwrap()
      toast.show('Moved to trash', { tone: 'success' })
      setPendingSoft(null)
      refresh({ page: 1 })
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Failed to delete', { tone: 'danger' })
    } finally {
      setBusyId(null)
    }
  }

  async function confirmHardDelete() {
    if (!pendingHard) return
    setBusyId(pendingHard.id)
    try {
      await dispatch(deleteContent(pendingHard.id)).unwrap()
      toast.show('Permanently deleted', { tone: 'success' })
      setPendingHard(null)
      refresh({ page: 1 })
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Failed to delete', { tone: 'danger' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <CmsPageShell
      title="All Content"
      subtitle="Manage blog posts, pages, products, and announcements."
      actions={
        <Button size="$3" icon={Icons.Plus} onPress={() => router.push('/admin/cms/new' as Href)}>
          New Content
        </Button>
      }
    >
      <XStack gap="$2" flexWrap="wrap">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Published', value: stats.published },
          { label: 'Drafts', value: stats.draft },
          { label: 'Scheduled', value: stats.scheduled },
          { label: 'Views', value: stats.views },
          { label: 'Comments', value: stats.comments },
        ].map((stat) => (
          <YStack
            key={stat.label}
            minWidth={isDesktop ? 120 : '46%'}
            flexGrow={1}
            padding="$3"
            borderRadius={12}
            backgroundColor={ui.surface}
            borderWidth={1}
            borderColor={ui.borderSubtle}
          >
            <Text fontSize={12} color={ui.textMuted} fontWeight="600">
              {stat.label}
            </Text>
            <Text fontSize={22} fontWeight="800" color={ui.text}>
              {stat.value}
            </Text>
          </YStack>
        ))}
      </XStack>

      <CmsPanel>
        <XStack gap="$2" flexWrap="wrap" alignItems="flex-end">
          <YStack flex={1} minWidth={200} gap="$1">
            <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
              Search
            </Text>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search title, slug, excerpt…"
              onSubmitEditing={() => refresh()}
            />
          </YStack>
          <YStack width={isDesktop ? 160 : '100%'} gap="$1">
            <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
              Type
            </Text>
            <CmsPickerSelect value={type} options={TYPE_OPTIONS} placeholder="Type" onValueChange={setType} />
          </YStack>
          <YStack width={isDesktop ? 160 : '100%'} gap="$1">
            <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
              Status
            </Text>
            <CmsPickerSelect
              value={status}
              options={STATUS_OPTIONS}
              placeholder="Status"
              onValueChange={setStatus}
            />
          </YStack>
          <YStack width={isDesktop ? 180 : '100%'} gap="$1">
            <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
              Category
            </Text>
            <CmsPickerSelect
              value={categoryId}
              options={categoryOptions}
              placeholder="Category"
              onValueChange={setCategoryId}
            />
          </YStack>
          <Button size="$3" onPress={() => refresh()}>
            Apply
          </Button>
          <Button
            size="$3"
            tone="outline"
            icon={Icons.RefreshCw}
            onPress={() => {
              setSearch('')
              setType('all')
              setStatus('all')
              setCategoryId('all')
              void dispatch(
                loadContents({
                  page: 1,
                  search: undefined,
                  type: undefined,
                  status: undefined,
                  category_id: undefined,
                }),
              )
            }}
          />
        </XStack>
      </CmsPanel>

      {pendingSoft ? (
        <CmsInlineConfirm
          title="Soft delete content?"
          description={`“${pendingSoft.title}” will be hidden but can be recovered.`}
          confirmLabel="Soft delete"
          tone="warning"
          loading={busyId === pendingSoft.id || isDeleting}
          onCancel={() => setPendingSoft(null)}
          onConfirm={() => void confirmSoftDelete()}
        />
      ) : null}

      {pendingHard ? (
        <CmsInlineConfirm
          title="Permanently delete?"
          description={`“${pendingHard.title}” and related links will be removed forever.`}
          confirmLabel="Delete forever"
          loading={busyId === pendingHard.id || isDeleting}
          onCancel={() => setPendingHard(null)}
          onConfirm={() => void confirmHardDelete()}
        />
      ) : null}

      {contentError ? <Text color={ui.error}>{contentError}</Text> : null}

      <CmsPanel gap="$2">
        {isFetching && items.length === 0 ? (
          <YStack minHeight={220} alignItems="center" justifyContent="center" gap="$2">
            <Spinner size="large" />
            <Text color={ui.textMuted}>Loading content…</Text>
          </YStack>
        ) : items.length === 0 ? (
          <YStack minHeight={180} alignItems="center" justifyContent="center" gap="$2">
            <Text fontWeight="700" color={ui.text}>
              No content found
            </Text>
            <Text color={ui.textMuted}>Create your first post or adjust filters.</Text>
            <Button icon={Icons.Plus} onPress={() => router.push('/admin/cms/new' as Href)}>
              New Content
            </Button>
          </YStack>
        ) : (
          items.map((item) => (
            <YStack
              key={item.id}
              gap="$3"
              padding="$3"
              borderRadius={12}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
            >
              <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={200} gap="$1">
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                    <Badge tone="neutral">{item.type}</Badge>
                    {item.is_featured ? <Badge tone="brand">Featured</Badge> : null}
                  </XStack>
                  <Text fontSize={16} fontWeight="800" color={ui.text}>
                    {item.title}
                  </Text>
                  <Text fontSize={12} color={ui.textMuted}>
                    /{item.slug}
                    {item.cms_categories?.name ? ` · ${item.cms_categories.name}` : ''}
                  </Text>
                  <Text fontSize={12} color={ui.textSecondary}>
                    {item.view_count ?? 0} views · {item.like_count ?? 0} likes ·{' '}
                    {item.comment_count ?? 0} comments
                  </Text>
                </YStack>
                <XStack gap="$2" flexWrap="wrap" alignItems="center">
                  <Button
                    size="$2"
                    tone="outline"
                    icon={Icons.Pencil}
                    onPress={() => router.push(cmsEditHref(item.id))}
                  >
                    Edit
                  </Button>
                  {item.status !== 'published' ? (
                    <Button
                      size="$2"
                      icon={Icons.Globe}
                      disabled={busyId === item.id}
                      onPress={() => void handlePublish(item)}
                    >
                      Publish
                    </Button>
                  ) : (
                    <Button
                      size="$2"
                      tone="outline"
                      icon={Icons.Archive}
                      disabled={busyId === item.id}
                      onPress={() => void handleArchive(item)}
                    >
                      Archive
                    </Button>
                  )}
                  <Button size="$2" tone="outline" onPress={() => setPendingSoft(item)}>
                    Trash
                  </Button>
                  <Button size="$2" tone="outline" onPress={() => setPendingHard(item)}>
                    <Icons.Trash2 size={14} color={ui.error} />
                  </Button>
                </XStack>
              </XStack>
            </YStack>
          ))
        )}

        {contentMeta.totalPages > 1 ? (
          <XStack justifyContent="space-between" alignItems="center" paddingTop="$2">
            <Text fontSize={13} color={ui.textMuted}>
              Page {contentMeta.page} of {contentMeta.totalPages} · {contentMeta.total} items
            </Text>
            <XStack gap="$2">
              <Button
                size="$2"
                tone="outline"
                disabled={!contentMeta.hasPrevPage || isFetching}
                onPress={() => refresh({ page: contentMeta.page - 1 })}
              >
                Previous
              </Button>
              <Button
                size="$2"
                tone="outline"
                disabled={!contentMeta.hasNextPage || isFetching}
                onPress={() => refresh({ page: contentMeta.page + 1 })}
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
