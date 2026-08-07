import { useEffect, useMemo, useState } from 'react'

import {
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
import {
  createTag,
  deleteTag,
  generateSlug,
  loadTags,
  updateTag,
  type CmsTag,
} from '~/lib/cms'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CmsInlineConfirm, CmsPageShell, CmsPanel } from './CmsPageShell'

type TagForm = { name: string; slug: string }

const EMPTY_FORM: TagForm = { name: '', slug: '' }

export function AdminCmsTagsPage() {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const ui = useAppUi()

  const { tags, isFetching, isCreating, isUpdating, isDeleting, tagError } = useAppSelector(
    (s) => s.cms,
  )

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TagForm>(EMPTY_FORM)
  const [slugManual, setSlugManual] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CmsTag | null>(null)

  useEffect(() => {
    void dispatch(loadTags())
  }, [dispatch])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return tags
    return tags.filter(
      (t) => t.name.toLowerCase().includes(needle) || t.slug.toLowerCase().includes(needle),
    )
  }, [search, tags])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSlugManual(false)
    setShowForm(true)
  }

  function openEdit(row: CmsTag) {
    setEditingId(row.id)
    setForm({ name: row.name, slug: row.slug })
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
    try {
      if (editingId) {
        await dispatch(updateTag({ id: editingId, payload: { name, slug } })).unwrap()
        toast.show('Tag updated', { tone: 'success' })
      } else {
        await dispatch(createTag({ name, slug })).unwrap()
        toast.show('Tag created', { tone: 'success' })
      }
      closeForm()
      void dispatch(loadTags())
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Save failed', { tone: 'danger' })
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await dispatch(deleteTag(pendingDelete.id)).unwrap()
      toast.show('Tag deleted', { tone: 'success' })
      setPendingDelete(null)
      if (editingId === pendingDelete.id) closeForm()
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Delete failed', { tone: 'danger' })
    }
  }

  return (
    <CmsPageShell
      title="Tags"
      subtitle="Manage reusable content tags."
      actions={
        <Button size="$3" icon={Icons.Plus} onPress={openCreate}>
          New Tag
        </Button>
      }
    >
      <CmsPanel>
        <Field label="Search">
          <Input value={search} onChangeText={setSearch} placeholder="Search tags…" />
        </Field>
      </CmsPanel>

      {showForm ? (
        <CmsPanel>
          <Text fontSize={16} fontWeight="800" color={ui.text} marginBottom="$2">
            {editingId ? 'Edit tag' : 'New tag'}
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
            <XStack gap="$2">
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
          title="Delete tag?"
          description={`“${pendingDelete.name}” will be permanently removed.`}
          confirmLabel="Delete"
          loading={isDeleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      {tagError ? <Text color={ui.error}>{tagError}</Text> : null}

      <CmsPanel gap="$2">
        {isFetching && filtered.length === 0 ? (
          <YStack minHeight={180} alignItems="center" justifyContent="center" gap="$2">
            <Spinner size="large" />
            <Text color={ui.textMuted}>Loading tags…</Text>
          </YStack>
        ) : filtered.length === 0 ? (
          <Text color={ui.textMuted}>No tags found.</Text>
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
              <YStack flex={1} minWidth={180} gap="$1">
                <Text fontWeight="800" color={ui.text}>
                  {row.name}
                </Text>
                <Text fontSize={12} color={ui.textMuted}>
                  /{row.slug}
                </Text>
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
