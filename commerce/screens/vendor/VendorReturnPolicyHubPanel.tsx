import { useCallback, useEffect, useMemo, useState } from 'react'

import { ReturnPolicyErrorBoundary } from '~/commerce/components/ReturnPolicyErrorBoundary'
import { ReturnPolicyFormDrawer } from '~/commerce/components/vendor/return-policy/ReturnPolicyFormDrawer'
import { ReturnPolicyHubSidebar } from '~/commerce/components/vendor/return-policy/ReturnPolicyHubSidebar'
import { ReturnPolicyListItem } from '~/commerce/components/vendor/return-policy/ReturnPolicyListItem'
import { ReturnPolicySearchField } from '~/commerce/components/vendor/return-policy/ReturnPolicySearchField'
import { ReturnPolicySummaryCards } from '~/commerce/components/vendor/return-policy/ReturnPolicySummaryCards'
import {
  Button,
  ConfirmDialog,
  Icons,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { toFriendlyReturnPolicyError } from '~/lib/return-policy/return-policy.errors'
import { RETURN_POLICY_UI_COPY } from '~/lib/return-policy/return-policy-ui.copy'
import {
  computeReturnPolicyHubStats,
  formDataToReturnPolicyInput,
} from '~/lib/return-policy/return-policy-ui.utils'
import type { ReturnPolicy, ReturnPolicyFormData } from '~/lib/return-policy/return-policy.type'
import {
  createReturnPolicy,
  deleteReturnPolicy,
  loadReturnPolicies,
  selectReturnPolicyDeleting,
  selectReturnPolicyError,
  selectReturnPolicyLoading,
  selectReturnPolicySaving,
  selectSortedReturnPolicies,
  setReturnPolicyShopId,
  updateReturnPolicy,
} from '~/lib/return-policy/return-policy.store'
import { filterReturnPoliciesByQuery } from '~/lib/return-policy/return-policy.utils'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type VendorReturnPolicyHubPanelProps = {
  ui: AppUiTokens
  shopId: string
  shopName?: string | null
  isDesktop: boolean
  safeBottom: number
}

export function VendorReturnPolicyHubPanel({
  ui,
  shopId,
  shopName,
  isDesktop,
  safeBottom,
}: VendorReturnPolicyHubPanelProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()

  const policies = useAppSelector(selectSortedReturnPolicies)
  const isLoading = useAppSelector(selectReturnPolicyLoading)
  const isSaving = useAppSelector(selectReturnPolicySaving)
  const isDeleting = useAppSelector(selectReturnPolicyDeleting)
  const storeError = useAppSelector(selectReturnPolicyError)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<ReturnPolicy | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ReturnPolicy | null>(null)

  const refreshPolicies = useCallback(async () => {
    await dispatch(loadReturnPolicies({ shopId, forceRefresh: true }))
  }, [dispatch, shopId])

  useEffect(() => {
    if (!shopId) return
    dispatch(setReturnPolicyShopId(shopId))
    void refreshPolicies().catch((error) => {
      toast.show(RETURN_POLICY_UI_COPY.loadError, {
        tone: 'danger',
        message: toFriendlyReturnPolicyError(error),
      })
    })
  }, [dispatch, refreshPolicies, shopId, toast])

  const stats = useMemo(() => computeReturnPolicyHubStats(policies), [policies])

  const filteredPolicies = useMemo(
    () => filterReturnPoliciesByQuery(policies, searchQuery),
    [policies, searchQuery],
  )

  const hasSearchQuery = searchQuery.trim().length > 0
  const isInitialLoading = isLoading && policies.length === 0 && !storeError

  function openCreateDrawer() {
    setEditingPolicy(null)
    setDrawerOpen(true)
  }

  function openEditDrawer(policy: ReturnPolicy) {
    setEditingPolicy(policy)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    if (isSaving || isDeleting) return
    setDrawerOpen(false)
    setEditingPolicy(null)
    setDeleteTarget(null)
  }

  async function handleSubmit(form: ReturnPolicyFormData) {
    const input = formDataToReturnPolicyInput(form)
    try {
      if (editingPolicy) {
        await dispatch(updateReturnPolicy({ policyId: editingPolicy.id, input })).unwrap()
        toast.show(RETURN_POLICY_UI_COPY.updateSuccess, { tone: 'success' })
      } else {
        await dispatch(createReturnPolicy({ shopId, input })).unwrap()
        toast.show(RETURN_POLICY_UI_COPY.createSuccess, { tone: 'success' })
      }
      closeDrawer()
    } catch (error) {
      toast.show(RETURN_POLICY_UI_COPY.saveFailed, {
        tone: 'danger',
        message: toFriendlyReturnPolicyError(error),
      })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await dispatch(deleteReturnPolicy({ policyId: deleteTarget.id })).unwrap()
      toast.show(RETURN_POLICY_UI_COPY.deleteSuccess, { tone: 'success' })
      setDeleteTarget(null)
      closeDrawer()
    } catch (error) {
      toast.show(RETURN_POLICY_UI_COPY.deleteFailed, {
        tone: 'danger',
        message: toFriendlyReturnPolicyError(error),
      })
    }
  }

  if (isInitialLoading) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$6">
        <Spinner size="small" />
        <Text fontSize={13} color={ui.textMuted}>
          Loading return policies…
        </Text>
      </XStack>
    )
  }

  return (
    <ReturnPolicyErrorBoundary
      scope="VendorReturnPolicyHub"
      title={RETURN_POLICY_UI_COPY.hubErrorTitle}
      onReset={() => void refreshPolicies()}
    >
      <YStack gap="$5" width="100%" maxWidth={1200} alignSelf="center">
        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={220} gap="$1">
            <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
              {RETURN_POLICY_UI_COPY.pageTitle}
            </Text>
            <Text fontSize={14} color={ui.textSecondary} maxWidth={620} lineHeight={21}>
              {RETURN_POLICY_UI_COPY.pageSubtitle}
            </Text>
          </YStack>
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            icon={<Icons.Plus size={16} />}
            onPress={openCreateDrawer}
          >
            {RETURN_POLICY_UI_COPY.createPolicy}
          </Button>
        </XStack>

        <ReturnPolicySummaryCards ui={ui} stats={stats} isDesktop={isDesktop} />

        {isDesktop ? (
          <XStack gap="$4" alignItems="flex-start" width="100%">
            <YStack flex={2} minWidth={0} gap="$3">
              <ReturnPolicySearchField
                ui={ui}
                value={searchQuery}
                onChange={setSearchQuery}
                resultCount={filteredPolicies.length}
                totalCount={policies.length}
              />
              <HubPolicyList
                ui={ui}
                policies={filteredPolicies}
                hasSearchQuery={hasSearchQuery}
                onEdit={openEditDrawer}
              />
            </YStack>
            <YStack flex={1} minWidth={280} maxWidth={360}>
              <ReturnPolicyHubSidebar ui={ui} />
            </YStack>
          </XStack>
        ) : (
          <YStack gap="$4">
            <ReturnPolicySearchField
              ui={ui}
              value={searchQuery}
              onChange={setSearchQuery}
              resultCount={filteredPolicies.length}
              totalCount={policies.length}
            />
            <HubPolicyList
              ui={ui}
              policies={filteredPolicies}
              hasSearchQuery={hasSearchQuery}
              onEdit={openEditDrawer}
            />
            <ReturnPolicyHubSidebar ui={ui} />
          </YStack>
        )}
      </YStack>

      <ReturnPolicyFormDrawer
        ui={ui}
        open={drawerOpen}
        isDesktop={isDesktop}
        shopName={shopName}
        editingPolicy={editingPolicy}
        submitting={isSaving || isDeleting}
        safeBottom={safeBottom}
        onClose={closeDrawer}
        onSubmit={(form) => void handleSubmit(form)}
        onDelete={editingPolicy ? () => setDeleteTarget(editingPolicy) : undefined}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={RETURN_POLICY_UI_COPY.deleteConfirmTitle}
        description={RETURN_POLICY_UI_COPY.deleteConfirmBody}
        confirmLabel={RETURN_POLICY_UI_COPY.deletePolicy}
        cancelLabel={RETURN_POLICY_UI_COPY.cancel}
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </ReturnPolicyErrorBoundary>
  )
}

function HubPolicyList({
  ui,
  policies,
  hasSearchQuery,
  onEdit,
}: {
  ui: AppUiTokens
  policies: ReturnPolicy[]
  hasSearchQuery: boolean
  onEdit: (policy: ReturnPolicy) => void
}) {
  return (
    <YStack gap="$3">
      <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
        {RETURN_POLICY_UI_COPY.activeFrameworks}
      </Text>
      <Text fontSize={13} color={ui.textMuted}>
        {RETURN_POLICY_UI_COPY.activeFrameworksHint}
      </Text>

      {policies.length === 0 ? (
        <YStack
          gap="$2"
          padding="$5"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
          alignItems="center"
        >
          <Icons.Undo2 size={28} color={ui.textMuted} />
          <Text fontSize={15} fontWeight="700" color={ui.text}>
            {hasSearchQuery ? RETURN_POLICY_UI_COPY.noSearchResults : RETURN_POLICY_UI_COPY.emptyPoliciesTitle}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
            {hasSearchQuery ? '' : RETURN_POLICY_UI_COPY.emptyPoliciesBody}
          </Text>
        </YStack>
      ) : (
        <YStack gap="$3">
          {policies.map((policy) => (
            <ReturnPolicyListItem key={policy.id} ui={ui} policy={policy} onPress={() => onEdit(policy)} />
          ))}
        </YStack>
      )}
    </YStack>
  )
}
