import { useEffect, useMemo, useState } from 'react'

import {
  Badge,
  Button,
  Field,
  Icons,
  Input,
  Spinner,
  Switch,
  Text,
  TextArea,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  createCategory,
  deleteCategory,
  generateSlug,
  loadCategories,
  updateCategory,
  type CmsCategory,
} from '~/lib/cms'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import {
  CmsInlineConfirm,
  CmsPageShell,
  CmsPanel,
  CmsPickerSelect,
} from './CmsPageShell'

type CategoryForm = {
  name: string
  slug: string
  description: string
  parent_id: string
  sort_order: string
  is_active: boolean
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  slug: '',
  description: '',
  parent_id: '',
  sort_order: '0',
  is_active: true,
}

export function AdminCmsCategoriesPage() {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  const { categories, isFetching, isCreating, isUpdating, isDeleting, categoryError } =
    useAppSelector((s) => s.cms)

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM)
  const [slugManual, setSlugManual] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CmsCategory | null>(null)

  useEffect(() => {
    void dispatch(loadCategories())
  }, [dispatch])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return categories
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) || c.slug.toLowerCase().includes(needle),
    )
  }, [categories, search])

  const parentOptions = useMemo(
    () => [
      { value: '_none', label: 'No parent' },
      ...categories
        .filter((c) => c.id !== editingId && c.is_active)
        .map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories, editingId],
  )

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSlugManual(false)
    setShowForm(true)
  }

  function openEdit(row: CmsCategory) {
    setEditingId(row.id)
    setForm({
      name: row.name,
      slug: row.slug,
      description: row.description ?? '',
      parent_id: row.parent_id ?? '',
      sort_order: String(row.sort_order ?? 0),
      is_active: row.is_active,
    })
    setSlugManual(true)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function submitForm() {
    const name = form.name.trim()
    const slug = form.slug.trim() || generateSlug(name)
    if (!name || !slug) {
      toast.show('Name and slug are required', { tone: 'danger' })
      return
    }
    const sortOrder = Number.parseInt(form.sort_order, 10)
    const payload = {
      name,
      slug,
      description: form.description.trim() || null,
      parent_id: form.parent_id || null,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      is_active: form.is_active,
    }
    try {
      if (editingId) {
        await dispatch(updateCategory({ id: editingId, payload })).unwrap()
        toast.show('Category updated', { tone: 'success' })
      } else {
        await dispatch(createCategory(payload)).unwrap()
        toast.show('Category created', { tone: 'success' })
      }
      closeForm()
      void dispatch(loadCategories())
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Save failed', { tone: 'danger' })
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await dispatch(deleteCategory({ id: pendingDelete.id })).unwrap()
      toast.show('Category deleted', { tone: 'success' })
      setPendingDelete(null)
      if (editingId === pendingDelete.id) closeForm()
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Delete failed', { tone: 'danger' })
    }
  }

  return (
    <CmsPageShell
      title="Categories"
      subtitle="Organize content with hierarchical categories."
      actions={
        <Button size="$3" icon={Icons.Plus} onPress={openCreate}>
          New Category
        </Button>
      }
    >
      <CmsPanel>
        <Field label="Search">
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search categories…"
          />
        </Field>
      </CmsPanel>

      {showForm ? (
        <CmsPanel>
          <Text fontSize={16} fontWeight="800" color={ui.text} marginBottom="$2">
            {editingId ? 'Edit category' : 'New category'}
          </Text>
          <YStack gap="$3">
            <Field label="Name" required>
              <Input
                value={form.name}
                onChangeText={(name) =>
                  setForm((prev) => ({
                    ...prev,
                    name,
                    slug: slugManual ? prev.slug : generateSlug(name),
                  }))
                }
              />
            </Field>
            <Field label="Slug" required>
              <XStack gap="$2" flexWrap="wrap" alignItems="center">
                <Input
                  flex={1}
                  minWidth={200}
                  value={form.slug}
                  onChangeText={(slug) => setForm((prev) => ({ ...prev, slug }))}
                  editable={slugManual || !!editingId}
                />
                {!editingId ? (
                  <Button size="$2" tone="outline" onPress={() => setSlugManual((v) => !v)}>
                    {slugManual ? 'Auto' : 'Edit'}
                  </Button>
                ) : null}
              </XStack>
            </Field>
            <Field label="Description">
              <TextArea
                value={form.description}
                onChangeText={(description) => setForm((prev) => ({ ...prev, description }))}
                minHeight={80}
              />
            </Field>
            <XStack gap="$3" flexWrap="wrap">
              <Field label="Parent" flex={1} minWidth={isDesktop ? 200 : '100%'}>
                <CmsPickerSelect
                  value={form.parent_id || '_none'}
                  options={parentOptions}
                  placeholder="Parent"
                  onValueChange={(parent_id) =>
                    setForm((prev) => ({
                      ...prev,
                      parent_id: parent_id === '_none' ? '' : parent_id,
                    }))
                  }
                />
              </Field>
              <Field label="Sort order" flex={1} minWidth={120}>
                <Input
                  value={form.sort_order}
                  onChangeText={(sort_order) => setForm((prev) => ({ ...prev, sort_order }))}
                  keyboardType="number-pad"
                />
              </Field>
            </XStack>
            <XStack alignItems="center" gap="$2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(is_active) => setForm((prev) => ({ ...prev, is_active }))}
              />
              <Text fontSize={14} color={ui.text}>
                Active
              </Text>
            </XStack>
            <XStack gap="$2" flexWrap="wrap">
              <Button onPress={() => void submitForm()} disabled={isCreating || isUpdating}>
                {editingId ? 'Update' : 'Create'}
              </Button>
              <Button tone="outline" onPress={closeForm}>
                Cancel
              </Button>
            </XStack>
          </YStack>
        </CmsPanel>
      ) : null}

      {pendingDelete ? (
        <CmsInlineConfirm
          title="Delete category?"
          description={`“${pendingDelete.name}” will be soft-deleted.`}
          confirmLabel="Delete"
          loading={isDeleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      {categoryError ? <Text color={ui.error}>{categoryError}</Text> : null}

      <CmsPanel gap="$2">
        {isFetching && filtered.length === 0 ? (
          <YStack minHeight={180} alignItems="center" justifyContent="center" gap="$2">
            <Spinner size="large" />
            <Text color={ui.textMuted}>Loading categories…</Text>
          </YStack>
        ) : filtered.length === 0 ? (
          <Text color={ui.textMuted}>No categories found.</Text>
        ) : (
          filtered.map((row) => (
            <XStack
              key={row.id}
              gap="$3"
              padding="$3"
              borderRadius={12}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surfaceMuted}
              flexWrap="wrap"
              justifyContent="space-between"
              alignItems="center"
            >
              <YStack flex={1} minWidth={200} gap="$1">
                <XStack gap="$2" flexWrap="wrap">
                  <Text fontWeight="800" color={ui.text}>
                    {row.name}
                  </Text>
                  <Badge tone={row.is_active ? 'success' : 'neutral'}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </XStack>
                <Text fontSize={12} color={ui.textMuted}>
                  /{row.slug}
                  {row.parent_id ? ` · parent set` : ''}
                  {` · order ${row.sort_order}`}
                </Text>
                {row.description ? (
                  <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
                    {row.description}
                  </Text>
                ) : null}
              </YStack>
              <XStack gap="$2">
                <Button size="$2" tone="outline" icon={Icons.Pencil} onPress={() => openEdit(row)}>
                  Edit
                </Button>
                <Button size="$2" tone="outline" onPress={() => setPendingDelete(row)}>
                  Delete
                </Button>
              </XStack>
            </XStack>
          ))
        )}
      </CmsPanel>
    </CmsPageShell>
  )
}
