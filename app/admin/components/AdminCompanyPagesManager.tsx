import { useCallback, useEffect, useState } from 'react'
import { useRouter, type Href } from 'one'

import {
  Badge,
  Button,
  ConfirmDialog,
  Icons,
  Image,
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
  COMPANY_PAGE_SIZE,
  fetchCompanies,
  type CompanyPage,
} from '~/community/lib/companies'
import { communityRoutes } from '~/lib/routes'
import { supabase } from '~/lib/supabase'
import { useAppUi } from '~/lib/theme/useAppUi'

export function AdminCompanyPagesManager() {
  const router = useRouter()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

  const [items, setItems] = useState<CompanyPage[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CompanyPage | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async (nextPage: number, replace: boolean) => {
    if (replace) setLoading(true)
    else setLoadingMore(true)
    setError(null)

    const result = await fetchCompanies(nextPage, debouncedSearch)
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
  }, [debouncedSearch])

  useEffect(() => {
    void load(0, true)
  }, [load])

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const { error: deleteError } = await supabase
      .from('companypages')
      .delete()
      .eq('id', pendingDelete.id)
    setDeleting(false)
    if (deleteError) {
      toast.show(deleteError.message, { tone: 'danger' })
      return
    }
    toast.show(`Deleted ${pendingDelete.name}`, { tone: 'success' })
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
          Company Pages
        </Text>
        <Text fontSize={14} color={ui.textSecondary}>
          Moderate brand and community business pages.
        </Text>
      </YStack>

      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or industry"
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
              <Text color={ui.textMuted}>No company pages found.</Text>
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
                    {row.logo_url ? (
                      <Image
                        source={{ uri: row.logo_url }}
                        width={44}
                        height={44}
                        borderRadius={radius.chip}
                      />
                    ) : (
                      <YStack
                        width={44}
                        height={44}
                        borderRadius={radius.chip}
                        backgroundColor={ui.surfaceMuted}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Icons.Store size={20} color={ui.textMuted} />
                      </YStack>
                    )}
                    <YStack flex={1} minWidth={0} gap="$0.5">
                      <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={1}>
                        {row.name}
                      </Text>
                      <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                        {row.industry} · {row.page_slug}
                      </Text>
                    </YStack>
                    <Badge>{row.size}</Badge>
                  </XStack>
                  <XStack gap="$2" flexWrap="wrap">
                    <Button
                      size="$2"
                      onPress={() => router.push(communityRoutes.company(row.id))}
                    >
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
              Showing {items.length} · page size {COMPANY_PAGE_SIZE}
            </Text>
          </YStack>
        </ScrollView>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null)
        }}
        title={`Delete ${pendingDelete?.name ?? 'company page'}`}
        description="This permanently removes the company page and related memberships where cascading allows."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={() => void confirmDelete()}
        destructive
      />
    </YStack>
  )
}
