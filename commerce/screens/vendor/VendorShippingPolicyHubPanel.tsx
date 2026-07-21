import { useCallback, useEffect, useMemo, useState } from 'react'

import { ShippingPolicyErrorBoundary } from '~/commerce/components/ShippingPolicyErrorBoundary'
import { ShippingPolicyFormDrawer } from '~/commerce/components/vendor/shipping-policy/ShippingPolicyFormDrawer'
import { ShippingPolicyListItem } from '~/commerce/components/vendor/shipping-policy/ShippingPolicyListItem'
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
import { loadAddresses, selectAddresses } from '~/lib/address/address.store'
import { getDefaultCountryCode, resolveCountryCode } from '~/lib/geo'
import { DEFAULT_SHOP_CURRENCY } from '~/lib/shop/shop.type'
import { toFriendlyShippingPolicyError } from '~/lib/shipping-policy/shipping-policy.errors'
import { SHIPPING_POLICY_UI_COPY } from '~/lib/shipping-policy/shipping-policy-ui.copy'
import { formDataToShippingPolicyInput } from '~/lib/shipping-policy/shipping-policy-ui.utils'
import type { ShippingPolicy, ShippingPolicyFormData } from '~/lib/shipping-policy/shipping-policy.type'
import {
  createShippingPolicy,
  deleteShippingPolicy,
  loadShippingPolicies,
  selectShippingPolicyDeleting,
  selectShippingPolicyError,
  selectShippingPolicyLoading,
  selectShippingPolicySaving,
  selectSortedShippingPolicies,
  setShippingPolicyShopId,
  updateShippingPolicy,
} from '~/lib/shipping-policy/shipping-policy.store'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type VendorShippingPolicyHubPanelProps = {
  ui: AppUiTokens
  shopId: string
  shopAddressId?: string | null
  shopCurrency?: string | null
  isDesktop: boolean
  safeBottom: number
}

export function VendorShippingPolicyHubPanel({
  ui,
  shopId,
  shopAddressId,
  shopCurrency,
  isDesktop,
  safeBottom,
}: VendorShippingPolicyHubPanelProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()

  const policies = useAppSelector(selectSortedShippingPolicies)
  const addresses = useAppSelector(selectAddresses)
  const isLoading = useAppSelector(selectShippingPolicyLoading)
  const isSaving = useAppSelector(selectShippingPolicySaving)
  const isDeleting = useAppSelector(selectShippingPolicyDeleting)
  const storeError = useAppSelector(selectShippingPolicyError)

  const currencyCode = shopCurrency?.trim() || DEFAULT_SHOP_CURRENCY

  const shopCountry = useMemo(() => {
    if (!shopAddressId) return getDefaultCountryCode()
    const address = addresses.find((row) => row.id === shopAddressId)
    return address?.country ? resolveCountryCode(address.country) : getDefaultCountryCode()
  }, [addresses, shopAddressId])

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<ShippingPolicy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ShippingPolicy | null>(null)

  const refreshPolicies = useCallback(async () => {
    await dispatch(loadShippingPolicies({ shopId, forceRefresh: true }))
  }, [dispatch, shopId])

  useEffect(() => {
    if (!shopId) return
    dispatch(setShippingPolicyShopId(shopId))
    void dispatch(loadAddresses(undefined))
    void refreshPolicies().catch((error) => {
      toast.show(SHIPPING_POLICY_UI_COPY.loadError, {
        tone: 'danger',
        message: toFriendlyShippingPolicyError(error),
      })
    })
  }, [dispatch, refreshPolicies, shopId, toast])

  const isInitialLoading = isLoading && policies.length === 0 && !storeError

  function openCreateDrawer() {
    setEditingPolicy(null)
    setDrawerOpen(true)
  }

  function openEditDrawer(policy: ShippingPolicy) {
    setEditingPolicy(policy)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    if (isSaving || isDeleting) return
    setDrawerOpen(false)
    setEditingPolicy(null)
    setDeleteTarget(null)
  }

  async function handleSubmit(form: ShippingPolicyFormData) {
    const input = formDataToShippingPolicyInput(form)
    try {
      if (editingPolicy) {
        await dispatch(updateShippingPolicy({ policyId: editingPolicy.id, input })).unwrap()
        toast.show(SHIPPING_POLICY_UI_COPY.updateSuccess, { tone: 'success' })
      } else {
        await dispatch(createShippingPolicy({ shopId, input })).unwrap()
        toast.show(SHIPPING_POLICY_UI_COPY.createSuccess, { tone: 'success' })
      }
      closeDrawer()
    } catch (error) {
      toast.show(SHIPPING_POLICY_UI_COPY.saveFailed, {
        tone: 'danger',
        message: toFriendlyShippingPolicyError(error),
      })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await dispatch(deleteShippingPolicy({ policyId: deleteTarget.id })).unwrap()
      toast.show(SHIPPING_POLICY_UI_COPY.deleteSuccess, { tone: 'success' })
      setDeleteTarget(null)
      closeDrawer()
    } catch (error) {
      toast.show(SHIPPING_POLICY_UI_COPY.deleteFailed, {
        tone: 'danger',
        message: toFriendlyShippingPolicyError(error),
      })
    }
  }

  if (isInitialLoading) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$6">
        <Spinner size="small" />
        <Text fontSize={13} color={ui.textMuted}>
          {SHIPPING_POLICY_UI_COPY.loading}
        </Text>
      </XStack>
    )
  }

  return (
    <ShippingPolicyErrorBoundary
      scope="VendorShippingPolicyHub"
      title={SHIPPING_POLICY_UI_COPY.hubErrorTitle}
      onReset={() => void refreshPolicies()}
    >
      <YStack gap="$5" width="100%" maxWidth={1200} alignSelf="center">
        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={220} gap="$1">
            <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
              {SHIPPING_POLICY_UI_COPY.pageTitle}
            </Text>
            <Text fontSize={14} color={ui.textSecondary} maxWidth={620} lineHeight={21}>
              {SHIPPING_POLICY_UI_COPY.pageSubtitle}
            </Text>
          </YStack>
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            icon={<Icons.Plus size={16} />}
            onPress={openCreateDrawer}
          >
            {SHIPPING_POLICY_UI_COPY.createProfile}
          </Button>
        </XStack>

        <YStack gap="$3">
          <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.2}>
            {SHIPPING_POLICY_UI_COPY.listTitle}
          </Text>
          <Text fontSize={13} color={ui.textMuted}>
            {SHIPPING_POLICY_UI_COPY.listHint}
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
              <Icons.Truck size={28} color={ui.textMuted} />
              <Text fontSize={15} fontWeight="700" color={ui.text}>
                {SHIPPING_POLICY_UI_COPY.emptyTitle}
              </Text>
              <Text fontSize={13} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
                {SHIPPING_POLICY_UI_COPY.emptyBody}
              </Text>
            </YStack>
          ) : (
            <YStack gap="$3">
              {policies.map((policy) => (
                <ShippingPolicyListItem
                  key={policy.id}
                  ui={ui}
                  policy={policy}
                  currencyCode={currencyCode}
                  onPress={() => openEditDrawer(policy)}
                />
              ))}
            </YStack>
          )}
        </YStack>
      </YStack>

      <ShippingPolicyFormDrawer
        ui={ui}
        open={drawerOpen}
        isDesktop={isDesktop}
        currencyCode={currencyCode}
        shopCountry={shopCountry}
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
        title={SHIPPING_POLICY_UI_COPY.deleteConfirmTitle}
        description={SHIPPING_POLICY_UI_COPY.deleteConfirmBody}
        confirmLabel={SHIPPING_POLICY_UI_COPY.deletePolicy}
        cancelLabel={SHIPPING_POLICY_UI_COPY.cancel}
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </ShippingPolicyErrorBoundary>
  )
}
