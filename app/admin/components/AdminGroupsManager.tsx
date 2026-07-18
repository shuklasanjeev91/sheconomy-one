import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'one'

import {
  Badge,
  Button,
  ConfirmDialog,
  Icons,
  Image,
  Input,
  ScrollView,
  Spinner,
  Switch,
  Text,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  fetchGroups,
  GROUP_PAGE_SIZE,
  type Group,
} from '~/community/lib/groups'
import { communityRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase'
import { useAppUi } from '~/lib/theme/useAppUi'

export function AdminGroupsManager() {
  const router = useRouter()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

  const [items, setItems] = useState<Group[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Group | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (replace) setLoading(true)
      else setLoadingMore(true)
      setError(null)

      const result = await fetchGroups(nextPage, debouncedSearch)
      if (result.error) {
        setError(result.error)
        if (replace) setItems([])
      } else if (replace) {
        setItems(result.items)
      } else {
        setItems((prev) => [...prev, ...result.items])
      }
      setHasMore(result.hasMore)
      setPage(nextPage)
      setLoading(false)
      setLoadingMore(false)
    },
    [debouncedSearch],
  )

  useEffect(() => {
    void load(0, true)
  }, [load])

  async function togglePostReview(row: Group, value: boolean) {
    setUpdatingId(row.id)
    const { error: updateError } = await supabase
      .from('groups')
      .update({ require_post_review: value, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    setUpdatingId(null)
    if (updateError) {
      toast.show(updateError.message, { tone: 'danger' })
      return
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === row.id ? { ...item, require_post_review: value } : item,
      ),
    )
    toast.show(value ? 'Post review required' : 'Post review optional', { tone: 'success' })
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const { error: deleteError } = await supabase.from('groups').delete().eq('id', pendingDelete.id)
    setDeleting(false)
    if (deleteError) {
      toast.show(deleteError.message, { tone: 'danger' })
      return
    }
    toast.show(`Deleted ${pendingDelete.title || pendingDelete.name}`, { tone: 'success' })
    setPendingDelete(null)
    void load(0, true)
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
          Groups
        </Text>
        <Text fontSize={14} color={ui.textSecondary}>
          Moderate community groups and posting rules.
        </Text>
      </YStack>

      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Search groups"
        backgroundColor={ui.surface}
      />

      {loading ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : error ? (
        <Text color={ui.danger}>{error}</Text>
      ) : (
        <ScrollView flex={1}>
          <YStack gap="$2">
            {items.length === 0 ? (
              <Text color={ui.textMuted}>No groups found.</Text>
            ) : (
              items.map((row) => (
                <YStack
                  key={row.id}
                  padding="$3.5"
                  borderRadius={radius.card}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                  gap="$2"
                  style={getShadowStyle('sm')}
                >
                  <XStack gap="$3" alignItems="center">
                    {row.avatar_url ? (
                      <Image
                        source={{ uri: row.avatar_url }}
                        width={44}
                        height={44}
                        borderRadius={999}
                      />
                    ) : (
                      <YStack
                        width={44}
                        height={44}
                        borderRadius={999}
                        backgroundColor={ui.surfaceMuted}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Icons.Users size={20} color={ui.textMuted} />
                      </YStack>
                    )}
                    <YStack flex={1} minWidth={0} gap="$0.5">
                      <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={1}>
                        {row.title || row.name}
                      </Text>
                      <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                        {row.members_count ?? 0} members · {row.group_type ?? 'public'}
                      </Text>
                    </YStack>
                    <Badge>{row.location || '—'}</Badge>
                  </XStack>

                  <XStack alignItems="center" justifyContent="space-between" gap="$2">
                    <Text fontSize={13} color={ui.textSecondary}>
                      Require post review
                    </Text>
                    <Switch
                      checked={Boolean(row.require_post_review)}
                      disabled={updatingId === row.id}
                      onCheckedChange={(value) => void togglePostReview(row, value)}
                    />
                  </XStack>

                  <XStack gap="$2" flexWrap="wrap">
                    <Button size="$2" onPress={() => router.push(communityRoutes.group(row.id))}>
                      <Text>View</Text>
                    </Button>
                    <Button size="$2" chromeless onPress={() => setPendingDelete(row)}>
                      <Icons.Trash2 size={16} color={ui.danger} />
                      <Text color={ui.danger}>Delete</Text>
                    </Button>
                  </XStack>
                </YStack>
              ))
            )}
            {hasMore ? (
              <Button
                marginTop="$2"
                disabled={loadingMore}
                onPress={() => void load(page + 1, false)}
              >
                {loadingMore ? <Spinner size="small" /> : <Text>Load more</Text>}
              </Button>
            ) : null}
            <Text fontSize={11} color={ui.textMuted}>
              Showing {items.length} · page size {GROUP_PAGE_SIZE}
            </Text>
          </YStack>
        </ScrollView>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
        title={`Delete ${pendingDelete?.title || pendingDelete?.name || 'group'}`}
        description="This permanently removes the group where cascading allows."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={() => void confirmDelete()}
        destructive
      />
    </YStack>
  )
}
