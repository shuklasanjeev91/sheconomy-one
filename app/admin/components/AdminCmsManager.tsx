import { useEffect, useMemo, useState } from 'react'
import { useRouter, type Href } from 'one'

import {
  Badge,
  Button,
  ConfirmDialog,
  Icons,
  Input,
  ScrollView,
  Spinner,
  Text,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  loadCategories,
  loadRedirects,
  loadTags,
  toggleRedirectActive,
  type CmsCategory,
  type CmsRedirect,
  type CmsTag,
} from '~/lib/cms'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

type CmsTab = 'categories' | 'tags' | 'redirects'

export function AdminCmsManager() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

  const { categories, tags, redirects, isFetching, contentError } = useAppSelector((s) => s.cms)

  const [tab, setTab] = useState<CmsTab>('categories')
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{
    kind: 'category' | 'tag'
    id: string
    label: string
  } | null>(null)

  useEffect(() => {
    void dispatch(loadCategories())
    void dispatch(loadTags())
    void dispatch(loadRedirects({ page: 1, limit: 50 }))
  }, [dispatch])

  const filteredCategories = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return categories
    return categories.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) || row.slug.toLowerCase().includes(needle),
    )
  }, [categories, search])

  const filteredTags = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return tags
    return tags.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) || row.slug.toLowerCase().includes(needle),
    )
  }, [tags, search])

  const filteredRedirects = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return redirects
    return redirects.filter(
      (row) =>
        row.from_path.toLowerCase().includes(needle) ||
        row.to_path.toLowerCase().includes(needle),
    )
  }, [redirects, search])

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    try {
      if (tab === 'categories') {
        await dispatch(createCategory({ name, slug: slugify(name) })).unwrap()
        toast.show('Category created', { tone: 'success' })
      } else if (tab === 'tags') {
        await dispatch(createTag({ name, slug: slugify(name) })).unwrap()
        toast.show('Tag created', { tone: 'success' })
      }
      setNewName('')
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not create', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setSaving(true)
    try {
      if (pendingDelete.kind === 'category') {
        await dispatch(deleteCategory({ id: pendingDelete.id })).unwrap()
      } else {
        await dispatch(deleteTag(pendingDelete.id)).unwrap()
      }
      toast.show(`${pendingDelete.label} deleted`, { tone: 'success' })
      setPendingDelete(null)
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not delete', { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleRedirect(row: CmsRedirect) {
    try {
      await dispatch(
        toggleRedirectActive({ id: row.id, isActive: !row.is_active }),
      ).unwrap()
      toast.show(row.is_active ? 'Redirect disabled' : 'Redirect enabled', { tone: 'success' })
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not update redirect', {
        tone: 'danger',
      })
    }
  }

  return (
    <YStack
      flex={1}
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={safeBottom + 24}
    >
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minWidth={200}>
          <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text}>
            CMS
          </Text>
          <Text fontSize={14} color={ui.textSecondary}>
            Categories, tags, redirects, and editorial content.
          </Text>
        </YStack>
        <Button size="$3" onPress={() => router.push('/admin/blog' as Href)}>
          <Icons.FileText size={16} />
          <Text>Open blog</Text>
        </Button>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        {(
          [
            ['categories', 'Categories'],
            ['tags', 'Tags'],
            ['redirects', 'Redirects'],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="$2"
            chromeless={tab !== id}
            backgroundColor={tab === id ? ui.brand : ui.surfaceMuted}
            onPress={() => setTab(id)}
          >
            <Text color={tab === id ? ui.onBrand : ui.text} fontWeight="600">
              {label}
            </Text>
          </Button>
        ))}
      </XStack>

      <Input
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${tab}…`}
        backgroundColor={ui.surface}
      />

      {tab !== 'redirects' ? (
        <XStack gap="$2" alignItems="center">
          <Input
            flex={1}
            value={newName}
            onChangeText={setNewName}
            placeholder={tab === 'categories' ? 'New category name' : 'New tag name'}
            backgroundColor={ui.surface}
          />
          <Button size="$3" disabled={saving || !newName.trim()} onPress={() => void handleCreate()}>
            {saving ? <Spinner size="small" /> : <Text>Add</Text>}
          </Button>
        </XStack>
      ) : null}

      {contentError ? <Text color={ui.danger}>{contentError}</Text> : null}

      {isFetching && categories.length === 0 && tags.length === 0 ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : (
        <ScrollView flex={1}>
          <YStack gap="$2">
            {tab === 'categories'
              ? filteredCategories.map((row) => (
                  <CategoryRow
                    key={row.id}
                    row={row}
                    onDelete={() =>
                      setPendingDelete({ kind: 'category', id: row.id, label: row.name })
                    }
                  />
                ))
              : null}
            {tab === 'tags'
              ? filteredTags.map((row) => (
                  <TagRow
                    key={row.id}
                    row={row}
                    onDelete={() => setPendingDelete({ kind: 'tag', id: row.id, label: row.name })}
                  />
                ))
              : null}
            {tab === 'redirects'
              ? filteredRedirects.map((row) => (
                  <RedirectRow
                    key={row.id}
                    row={row}
                    onToggle={() => void handleToggleRedirect(row)}
                  />
                ))
              : null}
            {tab === 'categories' && filteredCategories.length === 0 ? (
              <Text color={ui.textMuted}>No categories found.</Text>
            ) : null}
            {tab === 'tags' && filteredTags.length === 0 ? (
              <Text color={ui.textMuted}>No tags found.</Text>
            ) : null}
            {tab === 'redirects' && filteredRedirects.length === 0 ? (
              <Text color={ui.textMuted}>No redirects found.</Text>
            ) : null}
          </YStack>
        </ScrollView>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={`Delete ${pendingDelete?.label ?? ''}`}
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        destructive
      />
    </YStack>
  )
}

function CategoryRow({ row, onDelete }: { row: CmsCategory; onDelete: () => void }) {
  const ui = useAppUi()
  return (
    <YStack
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      gap="$1.5"
      style={getShadowStyle('sm')}
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <YStack flex={1} minWidth={0} gap="$0.5">
          <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={1}>
            {row.name}
          </Text>
          <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
            /{row.slug}
          </Text>
        </YStack>
        <XStack gap="$2" alignItems="center">
          <Badge>{row.is_active ? 'Active' : 'Inactive'}</Badge>
          <Button size="$2" chromeless onPress={onDelete}>
            <Icons.Trash2 size={16} color={ui.danger} />
          </Button>
        </XStack>
      </XStack>
      {row.description ? (
        <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
          {row.description}
        </Text>
      ) : null}
    </YStack>
  )
}

function TagRow({ row, onDelete }: { row: CmsTag; onDelete: () => void }) {
  const ui = useAppUi()
  return (
    <YStack
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      gap="$1"
      style={getShadowStyle('sm')}
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <YStack flex={1} minWidth={0}>
          <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={1}>
            {row.name}
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            /{row.slug}
          </Text>
        </YStack>
        <Button size="$2" chromeless onPress={onDelete}>
          <Icons.Trash2 size={16} color={ui.danger} />
        </Button>
      </XStack>
    </YStack>
  )
}

function RedirectRow({ row, onToggle }: { row: CmsRedirect; onToggle: () => void }) {
  const ui = useAppUi()
  return (
    <YStack
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      gap="$1.5"
      style={getShadowStyle('sm')}
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <YStack flex={1} minWidth={0} gap="$0.5">
          <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1}>
            {row.from_path}
          </Text>
          <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
            → {row.to_path ?? '—'}
          </Text>
        </YStack>
        <Button size="$2" onPress={onToggle}>
          <Text>{row.is_active ? 'Disable' : 'Enable'}</Text>
        </Button>
      </XStack>
      <Badge>{row.is_active ? 'Active' : 'Inactive'}</Badge>
    </YStack>
  )
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
