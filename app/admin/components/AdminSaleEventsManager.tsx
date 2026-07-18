import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
  Input,
  ScrollView,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Text,
  TextArea,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { supabase, type Tables, type TablesInsert } from '~/lib/supabase'
import { useAppUi } from '~/lib/theme/useAppUi'

type SaleEvent = Tables<'sale_events'>
type StatusFilter = 'all' | 'active' | 'draft' | 'ended' | 'cancelled'

type FormState = {
  event_name: string
  event_slug: string
  description: string
  banner_image: string
  start_date: string
  end_date: string
  status: string
  currency: string
}

const EMPTY_FORM: FormState = {
  event_name: '',
  event_slug: '',
  description: '',
  banner_image: '',
  start_date: '',
  end_date: '',
  status: 'draft',
  currency: 'INR',
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  try {
    return new Date(iso).toISOString().slice(0, 16)
  } catch {
    return ''
  }
}

export function AdminSaleEventsManager() {
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

  const [rows, setRows] = useState<SaleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SaleEvent | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [pendingDelete, setPendingDelete] = useState<SaleEvent | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from('sale_events')
      .select('*')
      .order('start_date', { ascending: false })
      .limit(200)
    if (loadError) setError(loadError.message)
    else setRows((data as SaleEvent[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!needle) return true
      return [row.event_name, row.event_slug, row.description, row.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [query, rows, statusFilter])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(row: SaleEvent) {
    setEditing(row)
    setForm({
      event_name: row.event_name,
      event_slug: row.event_slug,
      description: row.description ?? '',
      banner_image: row.banner_image ?? '',
      start_date: toLocalInput(row.start_date),
      end_date: toLocalInput(row.end_date),
      status: row.status,
      currency: row.currency || 'INR',
    })
    setFormOpen(true)
  }

  async function saveForm() {
    if (!form.event_name.trim() || !form.start_date || !form.end_date) {
      toast.show('Name, start, and end dates are required', { tone: 'danger' })
      return
    }
    setSaving(true)
    const slug = form.event_slug.trim() || slugify(form.event_name)
    const payload: TablesInsert<'sale_events'> = {
      event_name: form.event_name.trim(),
      event_slug: slug,
      description: form.description.trim() || null,
      banner_image: form.banner_image.trim() || null,
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      status: form.status,
      currency: form.currency || 'INR',
      updated_at: new Date().toISOString(),
    }

    const result = editing
      ? await supabase.from('sale_events').update(payload).eq('id', editing.id)
      : await supabase.from('sale_events').insert(payload)

    setSaving(false)
    if (result.error) {
      toast.show(result.error.message, { tone: 'danger' })
      return
    }
    toast.show(editing ? 'Sale event updated' : 'Sale event created', { tone: 'success' })
    setFormOpen(false)
    void load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setSaving(true)
    const { error: deleteError } = await supabase
      .from('sale_events')
      .delete()
      .eq('id', pendingDelete.id)
    setSaving(false)
    if (deleteError) {
      toast.show(deleteError.message, { tone: 'danger' })
      return
    }
    toast.show('Sale event deleted', { tone: 'success' })
    setPendingDelete(null)
    void load()
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
            Sale Events
          </Text>
          <Text fontSize={14} color={ui.textSecondary}>
            Plan promotional campaigns and marketplace sale collections.
          </Text>
        </YStack>
        <Button size="$3" onPress={openCreate}>
          <Text>New event</Text>
        </Button>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        <Input
          flex={1}
          minWidth={180}
          value={query}
          onChangeText={setQuery}
          placeholder="Search events"
          backgroundColor={ui.surface}
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger width={140} backgroundColor={ui.surface}>
            <Select.Value placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectViewport>
              {(['all', 'active', 'draft', 'ended', 'cancelled'] as const).map((value) => (
                <SelectItem key={value} value={value} index={0}>
                  {value}
                </SelectItem>
              ))}
            </SelectViewport>
          </SelectContent>
        </Select>
      </XStack>

      {loading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : error ? (
        <Text color={ui.danger}>{error}</Text>
      ) : (
        <ScrollView flex={1}>
          <YStack gap="$2">
            {filtered.length === 0 ? (
              <Text color={ui.textMuted}>No sale events found.</Text>
            ) : (
              filtered.map((row) => (
                <YStack
                  key={row.id}
                  padding="$3.5"
                  borderRadius={radius.card}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                  gap="$1.5"
                  style={getShadowStyle('sm')}
                >
                  <XStack justifyContent="space-between" alignItems="center" gap="$2">
                    <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={1} flex={1}>
                      {row.event_name}
                    </Text>
                    <Badge>{row.status}</Badge>
                  </XStack>
                  <Text fontSize={12} color={ui.textMuted}>
                    /{row.event_slug} · {new Date(row.start_date).toLocaleDateString()} →{' '}
                    {new Date(row.end_date).toLocaleDateString()}
                  </Text>
                  {row.description ? (
                    <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
                      {row.description}
                    </Text>
                  ) : null}
                  <XStack gap="$2">
                    <Button size="$2" onPress={() => openEdit(row)}>
                      <Text>Edit</Text>
                    </Button>
                    <Button size="$2" chromeless onPress={() => setPendingDelete(row)}>
                      <Text color={ui.danger}>Delete</Text>
                    </Button>
                  </XStack>
                </YStack>
              ))
            )}
          </YStack>
        </ScrollView>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogOverlay />
        <DialogContent maxWidth={480} width="92%">
          <DialogTitle>{editing ? 'Edit sale event' : 'New sale event'}</DialogTitle>
          <DialogDescription>Campaigns appear on home and shop promo surfaces.</DialogDescription>
          <YStack gap="$3" marginTop="$3">
            <Input
              value={form.event_name}
              onChangeText={(event_name) =>
                setForm((prev) => ({
                  ...prev,
                  event_name,
                  event_slug: prev.event_slug || slugify(event_name),
                }))
              }
              placeholder="Event name"
            />
            <Input
              value={form.event_slug}
              onChangeText={(event_slug) => setForm((prev) => ({ ...prev, event_slug }))}
              placeholder="event-slug"
            />
            <TextArea
              value={form.description}
              onChangeText={(description) => setForm((prev) => ({ ...prev, description }))}
              placeholder="Description"
              numberOfLines={3}
            />
            <Input
              value={form.banner_image}
              onChangeText={(banner_image) => setForm((prev) => ({ ...prev, banner_image }))}
              placeholder="Banner image URL"
            />
            <Input
              value={form.start_date}
              onChangeText={(start_date) => setForm((prev) => ({ ...prev, start_date }))}
              placeholder="Start (YYYY-MM-DDTHH:mm)"
            />
            <Input
              value={form.end_date}
              onChangeText={(end_date) => setForm((prev) => ({ ...prev, end_date }))}
              placeholder="End (YYYY-MM-DDTHH:mm)"
            />
            <Select
              value={form.status}
              onValueChange={(status) => setForm((prev) => ({ ...prev, status }))}
            >
              <SelectTrigger backgroundColor={ui.surfaceMuted}>
                <Select.Value placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectViewport>
                  {['draft', 'active', 'ended', 'cancelled'].map((value) => (
                    <SelectItem key={value} value={value} index={0}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectViewport>
              </SelectContent>
            </Select>
            <XStack gap="$2" justifyContent="flex-end">
              <Button chromeless onPress={() => setFormOpen(false)}>
                <Text>Cancel</Text>
              </Button>
              <Button disabled={saving} onPress={() => void saveForm()}>
                {saving ? <Spinner size="small" /> : <Text>Save</Text>}
              </Button>
            </XStack>
          </YStack>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={`Delete ${pendingDelete?.event_name ?? 'event'}`}
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        destructive
      />
    </YStack>
  )
}
