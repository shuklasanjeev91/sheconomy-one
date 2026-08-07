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
  CMS_REDIRECT_CODES,
  createRedirect,
  deleteRedirect,
  loadRedirects,
  toggleRedirectActive,
  updateRedirect,
  type CmsRedirect,
} from '~/lib/cms'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CmsInlineConfirm, CmsPageShell, CmsPanel, CmsPickerSelect } from './CmsPageShell'

type RedirectForm = {
  from_path: string
  to_path: string
  redirect_code: string
  note: string
  is_active: boolean
}

const EMPTY_FORM: RedirectForm = {
  from_path: '',
  to_path: '',
  redirect_code: '301',
  note: '',
  is_active: true,
}

const CODE_OPTIONS = CMS_REDIRECT_CODES.map((code) => ({
  value: String(code),
  label: String(code),
}))

export function AdminCmsRedirectsPage() {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  const { redirects, redirectMeta, isFetching, isCreating, isUpdating, isDeleting, redirectError } =
    useAppSelector((s) => s.cms)

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RedirectForm>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CmsRedirect | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void dispatch(loadRedirects({ page: 1, limit: 50 }))
  }, [dispatch])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return redirects
    return redirects.filter(
      (r) =>
        r.from_path.toLowerCase().includes(needle) ||
        (r.to_path ?? '').toLowerCase().includes(needle) ||
        (r.note ?? '').toLowerCase().includes(needle),
    )
  }, [redirects, search])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(row: CmsRedirect) {
    setEditingId(row.id)
    setForm({
      from_path: row.from_path,
      to_path: row.to_path ?? '',
      redirect_code: String(row.redirect_code),
      note: row.note ?? '',
      is_active: row.is_active,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function submitForm() {
    const from_path = form.from_path.trim()
    if (!from_path.startsWith('/')) {
      toast.show('from_path must start with /', { tone: 'danger' })
      return
    }
    const redirect_code = Number.parseInt(form.redirect_code, 10)
    const payload = {
      from_path,
      to_path: form.to_path.trim() || null,
      redirect_code: Number.isFinite(redirect_code) ? redirect_code : 301,
      note: form.note.trim() || null,
      is_active: form.is_active,
    }
    try {
      if (editingId) {
        await dispatch(updateRedirect({ id: editingId, payload })).unwrap()
        toast.show('Redirect updated', { tone: 'success' })
      } else {
        await dispatch(createRedirect(payload)).unwrap()
        toast.show('Redirect created', { tone: 'success' })
      }
      closeForm()
      void dispatch(loadRedirects({ page: redirectMeta.page, limit: 50 }))
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Save failed', { tone: 'danger' })
    }
  }

  async function handleToggle(row: CmsRedirect) {
    setBusyId(row.id)
    try {
      await dispatch(toggleRedirectActive({ id: row.id, isActive: !row.is_active })).unwrap()
      toast.show(row.is_active ? 'Redirect disabled' : 'Redirect enabled', { tone: 'success' })
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Update failed', { tone: 'danger' })
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await dispatch(deleteRedirect(pendingDelete.id)).unwrap()
      toast.show('Redirect deleted', { tone: 'success' })
      setPendingDelete(null)
      if (editingId === pendingDelete.id) closeForm()
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Delete failed', { tone: 'danger' })
    }
  }

  return (
    <CmsPageShell
      title="Redirects"
      subtitle="Manage SEO redirect rules."
      actions={
        <Button size="$3" icon={Icons.Plus} onPress={openCreate}>
          New Redirect
        </Button>
      }
    >
      <CmsPanel>
        <Field label="Search">
          <Input value={search} onChangeText={setSearch} placeholder="Search paths or notes…" />
        </Field>
      </CmsPanel>

      {showForm ? (
        <CmsPanel>
          <Text fontSize={16} fontWeight="800" color={ui.text} marginBottom="$2">
            {editingId ? 'Edit redirect' : 'New redirect'}
          </Text>
          <YStack gap="$3">
            <Field label="From path" required hint="Must start with /">
              <Input
                value={form.from_path}
                onChangeText={(from_path) => setForm((prev) => ({ ...prev, from_path }))}
                placeholder="/old-path"
              />
            </Field>
            <Field label="To path" hint="/new-path or https://…">
              <Input
                value={form.to_path}
                onChangeText={(to_path) => setForm((prev) => ({ ...prev, to_path }))}
                placeholder="/new-path"
              />
            </Field>
            <XStack gap="$3" flexWrap="wrap">
              <Field label="Redirect code" flex={1} minWidth={isDesktop ? 140 : '100%'}>
                <CmsPickerSelect
                  value={form.redirect_code}
                  options={CODE_OPTIONS}
                  placeholder="Code"
                  onValueChange={(redirect_code) =>
                    setForm((prev) => ({ ...prev, redirect_code }))
                  }
                />
              </Field>
              <XStack alignItems="center" gap="$2" paddingTop="$4">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(is_active) => setForm((prev) => ({ ...prev, is_active }))}
                />
                <Text fontSize={14} color={ui.text}>
                  Active
                </Text>
              </XStack>
            </XStack>
            <Field label="Note">
              <TextArea
                value={form.note}
                onChangeText={(note) => setForm((prev) => ({ ...prev, note }))}
                minHeight={72}
              />
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
          title="Delete redirect?"
          description={`Remove redirect from “${pendingDelete.from_path}”?`}
          confirmLabel="Delete"
          loading={isDeleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      {redirectError ? <Text color={ui.error}>{redirectError}</Text> : null}

      <CmsPanel gap="$2">
        {isFetching && filtered.length === 0 ? (
          <YStack minHeight={180} alignItems="center" justifyContent="center" gap="$2">
            <Spinner size="large" />
            <Text color={ui.textMuted}>Loading redirects…</Text>
          </YStack>
        ) : filtered.length === 0 ? (
          <Text color={ui.textMuted}>No redirects found.</Text>
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
              <YStack flex={1} minWidth={220} gap="$1">
                <XStack gap="$2" flexWrap="wrap">
                  <Badge tone={row.is_active ? 'success' : 'neutral'}>
                    {row.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge tone="info">{row.redirect_code}</Badge>
                </XStack>
                <Text fontWeight="800" color={ui.text}>
                  {row.from_path}
                </Text>
                <Text fontSize={13} color={ui.textSecondary}>
                  → {row.to_path || '(gone)'}
                </Text>
                {row.note ? (
                  <Text fontSize={12} color={ui.textMuted}>
                    {row.note}
                  </Text>
                ) : null}
                <Text fontSize={11} color={ui.textMuted}>
                  {row.hit_count} hits
                </Text>
              </YStack>
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  size="$2"
                  tone="outline"
                  disabled={busyId === row.id}
                  onPress={() => void handleToggle(row)}
                >
                  {row.is_active ? 'Disable' : 'Enable'}
                </Button>
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
