import { useEffect, useMemo, useState } from 'react'
import { useRouter, type Href } from 'one'

import {
  Badge,
  Button,
  ConfirmDialog,
  Input,
  ScrollView,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Text,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { supabase, type Tables } from '~/lib/supabase'
import { useAppUi } from '~/lib/theme/useAppUi'

type ReportRow = Tables<'content_reports'>
type EntityFilter = 'all' | string

export default function AdminModerationPage() {
  const router = useRouter()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{
    row: ReportRow
    action: 'dismiss' | 'resolve'
  } | null>(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('content_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (loadError) setError(loadError.message)
    else setRows((data as ReportRow[]) ?? [])
    setLoading(false)
  }

  const entityTypes = useMemo(() => {
    const set = new Set(rows.map((row) => row.entity_type).filter(Boolean))
    return ['all', ...Array.from(set).sort()]
  }, [rows])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (entityFilter !== 'all' && row.entity_type !== entityFilter) return false
      if (!needle) return true
      return [row.id, row.entity_type, row.entity_id, row.reason, row.details]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [entityFilter, query, rows])

  function entityHref(row: ReportRow): Href | null {
    if (row.entity_type === 'post') return `/community/post/${row.entity_id}` as Href
    if (row.entity_type === 'listing') return `/listing/${row.entity_id}` as Href
    if (row.entity_type === 'shop') return `/shop/${row.entity_id}` as Href
    if (row.entity_type === 'group') return `/community/group/${row.entity_id}` as Href
    if (row.entity_type === 'job') return `/community/jobs/${row.entity_id}` as Href
    return null
  }

  async function confirmAction() {
    if (!pending) return
    setActing(true)
    const { row, action } = pending

    if (action === 'resolve') {
      if (row.entity_type === 'post') {
        await supabase.from('posts').update({ is_deleted: true }).eq('id', row.entity_id)
      } else if (row.entity_type === 'listing') {
        await supabase
          .from('listings')
          .update({ is_active: false, listing_status: 'archived' })
          .eq('id', row.entity_id)
      }
    }

    const { error: deleteError } = await supabase
      .from('content_reports')
      .delete()
      .eq('id', row.id)

    setActing(false)
    if (deleteError) {
      toast.show(deleteError.message, { tone: 'danger' })
      return
    }

    toast.show(action === 'resolve' ? 'Report resolved' : 'Report dismissed', { tone: 'success' })
    setPending(null)
    setRows((prev) => prev.filter((item) => item.id !== row.id))
  }

  return (
    <YStack
      flex={1}
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={safeBottom + 24}
    >
      <YStack gap="$1">
        <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text}>
          Moderation
        </Text>
        <Text fontSize={14} color={ui.textSecondary}>
          Reported content across the platform.
        </Text>
      </YStack>

      <XStack gap="$2" flexWrap="wrap">
        <Input
          flex={1}
          minWidth={180}
          value={query}
          onChangeText={setQuery}
          placeholder="Search reports"
          backgroundColor={ui.surface}
        />
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger width={150} backgroundColor={ui.surface}>
            <Select.Value placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectViewport>
              {entityTypes.map((value) => (
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
              <Text color={ui.textMuted}>No reports yet.</Text>
            ) : (
              filtered.map((row) => {
                const href = entityHref(row)
                return (
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
                      <Text fontSize={14} fontWeight="700" color={ui.text} numberOfLines={1}>
                        {row.entity_type}
                      </Text>
                      <Badge>{row.reason}</Badge>
                    </XStack>
                    <Text fontSize={12} color={ui.textMuted}>
                      Entity {row.entity_id.slice(0, 8)} · reporter {row.reporter_id.slice(0, 8)}
                    </Text>
                    {row.details ? (
                      <Text fontSize={13} color={ui.textSecondary} numberOfLines={3}>
                        {row.details}
                      </Text>
                    ) : null}
                    <Text fontSize={11} color={ui.textMuted}>
                      {row.created_at ? new Date(row.created_at).toLocaleString() : ''}
                    </Text>
                    <XStack gap="$2" flexWrap="wrap">
                      {href ? (
                        <Button size="$2" onPress={() => router.push(href)}>
                          <Text>View</Text>
                        </Button>
                      ) : null}
                      <Button
                        size="$2"
                        onPress={() => setPending({ row, action: 'dismiss' })}
                      >
                        <Text>Dismiss</Text>
                      </Button>
                      <Button
                        size="$2"
                        chromeless
                        onPress={() => setPending({ row, action: 'resolve' })}
                      >
                        <Text color={ui.danger}>Resolve</Text>
                      </Button>
                    </XStack>
                  </YStack>
                )
              })
            )}
          </YStack>
        </ScrollView>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open && !acting) setPending(null)
        }}
        title={pending?.action === 'resolve' ? 'Resolve report' : 'Dismiss report'}
        description={
          pending?.action === 'resolve'
            ? 'Hide/archive the reported entity when supported, then clear this report.'
            : 'Remove this report from the queue without changing the entity.'
        }
        confirmLabel={acting ? 'Working…' : pending?.action === 'resolve' ? 'Resolve' : 'Dismiss'}
        onConfirm={() => void confirmAction()}
        destructive={pending?.action === 'resolve'}
      />
    </YStack>
  )
}
