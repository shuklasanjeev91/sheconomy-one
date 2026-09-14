import { useCallback, useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'
import { useRouter } from 'one'

import { DiscountErrorBoundary } from '~/commerce/components/DiscountErrorBoundary'
import { VendorNoShopState } from '~/commerce/components/vendor/VendorShopGate'
import { DiscountFilterTabs } from '~/commerce/components/vendor/discount/DiscountFilterTabs'
import {
  DiscountListEmpty,
  DiscountListItem,
  DiscountListPanel,
} from '~/commerce/components/vendor/discount/DiscountListItem'
import { DiscountSummaryCards } from '~/commerce/components/vendor/discount/DiscountSummaryCards'
import { rowsToCsv } from '~/commerce/lib/vendor-operations'
import { PageCenter } from '~/components/layout'
import { Button, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { DISCOUNT_FETCH_SCOPE } from '~/lib/discount/discount.constants'
import { toFriendlyDiscountError } from '~/lib/discount/discount.errors'
import { DISCOUNT_UI_COPY } from '~/lib/discount/discount-ui.copy'
import {
  buildDiscountExportRows,
  buildDiscountSummaryCards,
  filterDiscountsBySearch,
  filterDiscountsByTab,
  type DiscountHubTab,
} from '~/lib/discount/discount-ui.utils'
import * as discountService from '~/lib/discount/discount.service'
import {
  clearDiscountError,
  deleteDiscountProfile,
  loadShopDiscounts,
  selectActiveDiscounts,
  selectDiscountStats,
  setDiscountFetchScope,
  setDiscountFilters,
  setDiscountShopId,
  updateDiscountProfile,
} from '~/lib/discount/discount.store'
import { communityRoutes, vendorRoutes } from '~/lib/routes'
import { AppLink } from '~/components/navigation'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorDiscountScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()

  const shop = useAppSelector((state) => state.shop.currentShop)
  const isLoadingMyShops = useAppSelector((state) => state.shop.isLoadingMyShops)
  const myShopsLoaded = useAppSelector((state) => state.shop.myShopsLoaded)
  const profile = useAppSelector((state) => state.profile.profile)
  const discounts = useAppSelector((state) => state.discount.discounts)
  const loading = useAppSelector((state) => state.discount.loading)
  const error = useAppSelector((state) => state.discount.error)
  const stats = useAppSelector(selectDiscountStats)
  const activeDiscounts = useAppSelector(selectActiveDiscounts)

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<DiscountHubTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const accessContext = useMemo(
    () => ({
      userId: profile?.id,
      role: profile?.role,
    }),
    [profile?.id, profile?.role],
  )

  const shopUtils = useVendorCurrency()
  const summaryCards = useMemo(() => buildDiscountSummaryCards(stats), [stats])

  const visibleDiscounts = useMemo(() => {
    const byTab = filterDiscountsByTab(discounts, activeTab)
    return filterDiscountsBySearch(byTab, searchQuery)
  }, [activeTab, discounts, searchQuery])

  const reloadDiscounts = useCallback(async () => {
    if (!shop?.id) return
    await dispatch(
      loadShopDiscounts({
        shopId: shop.id,
        accessContext,
        scope: DISCOUNT_FETCH_SCOPE.VENDOR,
        forceRefresh: true,
      }),
    ).unwrap()
  }, [accessContext, dispatch, shop?.id])

  useEffect(() => {
    if (!shop?.id) {
      setInitialLoading(false)
      return
    }

    dispatch(setDiscountShopId(shop.id))
    dispatch(setDiscountFetchScope(DISCOUNT_FETCH_SCOPE.VENDOR))

    setInitialLoading(true)
    void reloadDiscounts()
      .catch((err) => {
        toast.show(DISCOUNT_UI_COPY.loadError, {
          tone: 'danger',
          message: toFriendlyDiscountError(err),
        })
      })
      .finally(() => setInitialLoading(false))

    return () => {
      dispatch(clearDiscountError())
    }
  }, [dispatch, reloadDiscounts, shop?.id, toast, reloadKey])

  async function handleRefresh() {
    if (!shop?.id) return
    setRefreshing(true)
    try {
      await reloadDiscounts()
      toast.show(DISCOUNT_UI_COPY.refreshSuccess, { tone: 'success' })
    } catch (err) {
      toast.show(DISCOUNT_UI_COPY.loadError, {
        tone: 'danger',
        message: toFriendlyDiscountError(err),
      })
    } finally {
      setRefreshing(false)
    }
  }

  async function handleToggleActive(discountId: string, isActive: boolean) {
    if (!shop?.id) return
    try {
      await dispatch(
        updateDiscountProfile({
          discountId,
          shopId: shop.id,
          updates: { is_active: !isActive },
          accessContext,
          scope: DISCOUNT_FETCH_SCOPE.VENDOR,
        }),
      ).unwrap()
      toast.show(DISCOUNT_UI_COPY.toggleActiveSuccess(!isActive), { tone: 'success' })
    } catch (err) {
      toast.show(DISCOUNT_UI_COPY.updateError, {
        tone: 'danger',
        message: toFriendlyDiscountError(err),
      })
    }
  }

  async function handleAssign(discountId: string, usernameOrEmail: string) {
    if (!shop?.id) return
    const result = await discountService.assignDiscountToCustomer({
      discountId,
      shopId: shop.id,
      usernameOrEmail,
      accessContext,
      scope: DISCOUNT_FETCH_SCOPE.VENDOR,
    })
    if (!result.success) {
      toast.show(result.error ?? 'Could not assign offer', { tone: 'danger' })
      return
    }
    toast.show('Offer assigned to customer', { tone: 'success' })
  }

  async function handleDelete(discountId: string) {
    if (!shop?.id) return
    try {
      await dispatch(
        deleteDiscountProfile({
          discountId,
          shopId: shop.id,
          accessContext,
          scope: DISCOUNT_FETCH_SCOPE.VENDOR,
        }),
      ).unwrap()
      toast.show(DISCOUNT_UI_COPY.deleteSuccess, { tone: 'success' })
    } catch (err) {
      toast.show(DISCOUNT_UI_COPY.deleteError, {
        tone: 'danger',
        message: toFriendlyDiscountError(err),
      })
    }
  }

  async function handleExport() {
    const rows = buildDiscountExportRows(visibleDiscounts)
    const csv = rowsToCsv(rows as unknown as Array<Record<string, unknown>>)
    if (!csv) {
      toast.show(DISCOUNT_UI_COPY.exportEmpty, { tone: 'info' })
      return
    }
    await Share.share({ title: 'Discounts export', message: csv })
    toast.show(DISCOUNT_UI_COPY.exportSuccess, { tone: 'success' })
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value)
    dispatch(setDiscountFilters({ search: value || null }))
  }

  if (!shop && (isLoadingMyShops || !myShopsLoaded)) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (!shop) {
    return (
      <VendorNoShopState
        ui={ui}
        title={DISCOUNT_UI_COPY.noShopTitle}
        body={DISCOUNT_UI_COPY.noShopBody}
      />
    )
  }

  return (
    <DiscountErrorBoundary scope="vendor-discounts" onReset={() => setReloadKey((k) => k + 1)}>
      <YStack
        width="100%"
        gap="$4"
        paddingHorizontal={isDesktop ? '$6' : '$4'}
        paddingTop={isDesktop ? '$6' : '$4'}
        paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
      >
        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <YStack gap="$1" flex={1} minWidth={220}>
            <Text fontSize={isDesktop ? 28 : 23} fontWeight="800" color={ui.text}>
              {DISCOUNT_UI_COPY.screenTitle}
            </Text>
            <Text fontSize={13} color={ui.textSecondary}>
              {DISCOUNT_UI_COPY.screenSubtitle(shop.shop_name)}
            </Text>
          </YStack>
          <XStack gap="$2" flexWrap="wrap">
            <AppLink href={communityRoutes.ads} asChild>
              <Button tone="outline" size="$3" icon={<Icons.Megaphone size={15} />}>
                Ads Manager
              </Button>
            </AppLink>
            <Button
              tone="primary"
              size="$3"
              icon={<Icons.Plus size={15} />}
              onPress={() => router.push(vendorRoutes.createDiscount)}
            >
              {DISCOUNT_UI_COPY.actions.createNew}
            </Button>
            <Button
              tone="outline"
              size="$3"
              icon={<Icons.RefreshCw size={15} />}
              disabled={refreshing || loading.discounts}
              onPress={() => void handleRefresh()}
            >
              {DISCOUNT_UI_COPY.actions.refresh}
            </Button>
            <Button tone="outline" size="$3" icon={<Icons.Download size={15} />} onPress={() => void handleExport()}>
              {DISCOUNT_UI_COPY.actions.export}
            </Button>
          </XStack>
        </XStack>

        {error ? (
          <Text fontSize={13} color={ui.danger}>
            {error}
          </Text>
        ) : null}

        {initialLoading ? (
          <YStack minHeight={240} alignItems="center" justifyContent="center">
            <Spinner size="large" />
          </YStack>
        ) : (
          <>
            <DiscountSummaryCards ui={ui} cards={summaryCards} />

            <YStack gap="$3">
              <DiscountFilterTabs ui={ui} activeTab={activeTab} onChange={setActiveTab} />
              <Input
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder={DISCOUNT_UI_COPY.searchPlaceholder}
              />
            </YStack>

            <DiscountListPanel ui={ui} title={DISCOUNT_UI_COPY.listPanelTitle}>
              {visibleDiscounts.length ? (
                visibleDiscounts.map((discount) => (
                  <DiscountListItem
                    key={discount.id}
                    ui={ui}
                    discount={discount}
                    currencySymbol={shopUtils.currencySymbol}
                    busy={loading.updating || loading.deleting}
                    onToggleActive={() => void handleToggleActive(discount.id, discount.is_active)}
                    onDelete={() => void handleDelete(discount.id)}
                    onAssign={(usernameOrEmail) => void handleAssign(discount.id, usernameOrEmail)}
                  />
                ))
              ) : (
                <DiscountListEmpty ui={ui} />
              )}
            </DiscountListPanel>

            {activeDiscounts.length > 0 ? (
              <Text fontSize={12} color={ui.textMuted}>
                {activeDiscounts.length} active discount{activeDiscounts.length === 1 ? '' : 's'} available to buyers.
              </Text>
            ) : null}
          </>
        )}
      </YStack>
    </DiscountErrorBoundary>
  )
}
