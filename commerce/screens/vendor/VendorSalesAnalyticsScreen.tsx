import { useCallback, useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'

import { SalesAnalyticsErrorBoundary } from '~/commerce/components/SalesAnalyticsErrorBoundary'
import { SalesAnalyticsFiltersPanel } from '~/commerce/components/vendor/sales-analytics/SalesAnalyticsFiltersPanel'
import { SalesAnalyticsHubTabs } from '~/commerce/components/vendor/sales-analytics/SalesAnalyticsHubTabs'
import { SalesAnalyticsRecordsList } from '~/commerce/components/vendor/sales-analytics/SalesAnalyticsRecordsList'
import { SalesAnalyticsRegionalPanel } from '~/commerce/components/vendor/sales-analytics/SalesAnalyticsRegionalPanel'
import { SalesAnalyticsSummaryCards } from '~/commerce/components/vendor/sales-analytics/SalesAnalyticsSummaryCards'
import { SalesAnalyticsTopProductsPanel } from '~/commerce/components/vendor/sales-analytics/SalesAnalyticsTopProductsPanel'
import { SalesAnalyticsTrendPanel } from '~/commerce/components/vendor/sales-analytics/SalesAnalyticsTrendPanel'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { EXPORT_FORMATS, SALES_ANALYTICS_FETCH_SCOPE } from '~/lib/sales-analytics/sales-analytics.constants'
import { toFriendlySalesAnalyticsError } from '~/lib/sales-analytics/sales-analytics.errors'
import { SALES_ANALYTICS_UI_COPY } from '~/lib/sales-analytics/sales-analytics-ui.copy'
import {
  buildSalesAnalyticsSummaryCards,
  buildSalesCategoryPoints,
  buildSalesTrendPoints,
  getSalesAnalyticsHubTabs,
  type SalesAnalyticsHubTab,
} from '~/lib/sales-analytics/sales-analytics-ui.utils'
import {
  clearSalesAnalyticsError,
  exportSalesData,
  loadDetailedSalesRecords,
  loadMoreDetailedSalesRecords,
  loadRegionalSales,
  loadSalesAnalytics,
  loadSalesSummary,
  loadTopProducts,
  refreshAllSalesData,
  resetSalesAnalyticsFilters,
  selectDetailedSalesRecords,
  selectRegionalSales,
  selectSalesAnalytics,
  selectSalesAnalyticsError,
  selectSalesAnalyticsFilters,
  selectSalesAnalyticsLoading,
  selectSalesAnalyticsPagination,
  selectSalesSummary,
  selectTopProducts,
  setSalesAnalyticsFetchScope,
  setSalesAnalyticsFilters,
  setSalesAnalyticsShopId,
} from '~/lib/sales-analytics/sales-analytics.store'
import { useVendorCurrency } from '~/hooks/useVendorCurrency'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

export function VendorSalesAnalyticsScreen() {
  const ui = useAppUi()
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()

  const shop = useAppSelector((state) => state.shop.currentShop)
  const profile = useAppSelector((state) => state.profile.profile)

  const salesAnalytics = useAppSelector(selectSalesAnalytics)
  const detailedRecords = useAppSelector(selectDetailedSalesRecords)
  const topProducts = useAppSelector(selectTopProducts)
  const regionalSales = useAppSelector(selectRegionalSales)
  const salesSummary = useAppSelector(selectSalesSummary)
  const filters = useAppSelector(selectSalesAnalyticsFilters)
  const pagination = useAppSelector(selectSalesAnalyticsPagination)
  const loading = useAppSelector(selectSalesAnalyticsLoading)
  const error = useAppSelector(selectSalesAnalyticsError)

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<SalesAnalyticsHubTab>('overview')
  const [showFilters, setShowFilters] = useState(false)

  const accessContext = useMemo(
    () => ({
      userId: profile?.id,
      role: profile?.role,
    }),
    [profile?.id, profile?.role],
  )

  const shopUtils = useVendorCurrency()
  const formatAmount = shopUtils.formatAmount

  const summaryCards = useMemo(
    () => buildSalesAnalyticsSummaryCards(salesSummary, formatAmount),
    [salesSummary, formatAmount],
  )
  const trendPoints = useMemo(() => buildSalesTrendPoints(salesAnalytics), [salesAnalytics])
  const categoryPoints = useMemo(() => buildSalesCategoryPoints(salesAnalytics), [salesAnalytics])
  const tabs = useMemo(
    () => getSalesAnalyticsHubTabs(detailedRecords.length),
    [detailedRecords.length],
  )

  const reloadAll = useCallback(async () => {
    if (!shop?.id) return

    await Promise.all([
      dispatch(
        loadSalesAnalytics({
          shopId: shop.id,
          accessContext,
          scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
          forceRefresh: true,
        }),
      ).unwrap(),
      dispatch(
        loadSalesSummary({
          shopId: shop.id,
          accessContext,
          scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
          forceRefresh: true,
        }),
      ).unwrap(),
      dispatch(
        loadDetailedSalesRecords({
          shopId: shop.id,
          reset: true,
          accessContext,
          scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
        }),
      ).unwrap(),
      dispatch(
        loadTopProducts({
          shopId: shop.id,
          accessContext,
          scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
        }),
      ).unwrap(),
      dispatch(
        loadRegionalSales({
          shopId: shop.id,
          accessContext,
          scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
        }),
      ).unwrap(),
    ])
  }, [accessContext, dispatch, shop?.id])

  useEffect(() => {
    if (!shop?.id) {
      setInitialLoading(false)
      return
    }

    dispatch(setSalesAnalyticsShopId(shop.id))
    dispatch(setSalesAnalyticsFetchScope(SALES_ANALYTICS_FETCH_SCOPE.VENDOR))

    setInitialLoading(true)
    void reloadAll()
      .catch((err) => {
        toast.show(SALES_ANALYTICS_UI_COPY.loadError, {
          tone: 'danger',
          message: toFriendlySalesAnalyticsError(err),
        })
      })
      .finally(() => setInitialLoading(false))

    return () => {
      dispatch(clearSalesAnalyticsError())
    }
  }, [dispatch, reloadAll, shop?.id, toast])

  async function handleRefresh() {
    if (!shop?.id) return
    setRefreshing(true)
    try {
      await dispatch(
        refreshAllSalesData({
          shopId: shop.id,
          accessContext,
          scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
        }),
      ).unwrap()
      await dispatch(
        loadDetailedSalesRecords({
          shopId: shop.id,
          reset: true,
          accessContext,
          scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
        }),
      ).unwrap()
      toast.show(SALES_ANALYTICS_UI_COPY.refreshSuccess, { tone: 'success' })
    } catch (err) {
      toast.show(SALES_ANALYTICS_UI_COPY.loadError, {
        tone: 'danger',
        message: toFriendlySalesAnalyticsError(err),
      })
    } finally {
      setRefreshing(false)
    }
  }

  async function handleFilterChange(nextFilters: Partial<typeof filters>) {
    if (!shop?.id) return
    dispatch(setSalesAnalyticsFilters(nextFilters))
    try {
      await Promise.all([
        dispatch(
          loadSalesAnalytics({
            shopId: shop.id,
            filters: nextFilters,
            accessContext,
            scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
            forceRefresh: true,
          }),
        ).unwrap(),
        dispatch(
          loadSalesSummary({
            shopId: shop.id,
            filters: nextFilters,
            accessContext,
            scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
            forceRefresh: true,
          }),
        ).unwrap(),
        dispatch(
          loadDetailedSalesRecords({
            shopId: shop.id,
            reset: true,
            filters: nextFilters,
            accessContext,
            scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
          }),
        ).unwrap(),
        dispatch(
          loadTopProducts({
            shopId: shop.id,
            accessContext,
            scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
          }),
        ).unwrap(),
        dispatch(
          loadRegionalSales({
            shopId: shop.id,
            accessContext,
            scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
          }),
        ).unwrap(),
      ])
    } catch (err) {
      toast.show(SALES_ANALYTICS_UI_COPY.loadError, {
        tone: 'danger',
        message: toFriendlySalesAnalyticsError(err),
      })
    }
  }

  async function handleFilterReset() {
    if (!shop?.id) return
    dispatch(resetSalesAnalyticsFilters())
    try {
      await reloadAll()
    } catch (err) {
      toast.show(SALES_ANALYTICS_UI_COPY.loadError, {
        tone: 'danger',
        message: toFriendlySalesAnalyticsError(err),
      })
    }
  }

  async function handleExport() {
    if (!shop?.id) return
    setExporting(true)
    try {
      const result = await dispatch(
        exportSalesData({
          shopId: shop.id,
          format: EXPORT_FORMATS.CSV,
          accessContext,
          scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
        }),
      ).unwrap()

      const content = result.content ?? ''
      if (!content) {
        toast.show(SALES_ANALYTICS_UI_COPY.exportEmpty, { tone: 'info' })
        return
      }

      await Share.share({
        title: result.filename,
        message: content,
      })
      toast.show(SALES_ANALYTICS_UI_COPY.exportSuccess, { tone: 'success' })
    } catch (err) {
      toast.show(SALES_ANALYTICS_UI_COPY.exportError, {
        tone: 'danger',
        message: toFriendlySalesAnalyticsError(err),
      })
    } finally {
      setExporting(false)
    }
  }

  async function handleLoadMoreRecords() {
    if (!shop?.id || !pagination.hasMore) return
    try {
      await dispatch(
        loadMoreDetailedSalesRecords({
          shopId: shop.id,
          accessContext,
          scope: SALES_ANALYTICS_FETCH_SCOPE.VENDOR,
        }),
      ).unwrap()
    } catch (err) {
      toast.show(SALES_ANALYTICS_UI_COPY.loadError, {
        tone: 'danger',
        message: toFriendlySalesAnalyticsError(err),
      })
    }
  }

  if (!shop) {
    return (
      <YStack minHeight={360} alignItems="center" justifyContent="center" gap="$2" padding="$4">
        <Icons.Store size={30} color={ui.textMuted} />
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          {SALES_ANALYTICS_UI_COPY.noShopTitle}
        </Text>
        <Text fontSize={13} color={ui.textSecondary} textAlign="center" maxWidth={360}>
          {SALES_ANALYTICS_UI_COPY.noShopBody}
        </Text>
      </YStack>
    )
  }

  return (
    <SalesAnalyticsErrorBoundary scope="vendor-sales-analytics" onReset={() => void handleRefresh()}>
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
              {SALES_ANALYTICS_UI_COPY.screenTitle}
            </Text>
            <Text fontSize={13} color={ui.textSecondary}>
              {SALES_ANALYTICS_UI_COPY.screenSubtitle(shop.shop_name ?? 'your shop')}
            </Text>
          </YStack>

          <XStack gap="$2" flexWrap="wrap">
            <Button
              tone="outline"
              size="$3"
              icon={<Icons.Filter size={15} />}
              onPress={() => setShowFilters((current) => !current)}
            >
              {showFilters ? 'Hide filters' : 'Filters'}
            </Button>
            <Button
              tone="outline"
              size="$3"
              icon={<Icons.RefreshCw size={15} />}
              disabled={refreshing || loading.analytics || loading.summary}
              onPress={() => void handleRefresh()}
            >
              Refresh
            </Button>
            <Button
              tone="outline"
              size="$3"
              icon={<Icons.Download size={15} />}
              disabled={exporting || loading.exporting}
              onPress={() => void handleExport()}
            >
              Export
            </Button>
          </XStack>
        </XStack>

        {showFilters ? (
          <SalesAnalyticsFiltersPanel
            ui={ui}
            filters={filters}
            loading={loading.analytics}
            onChange={(next) => void handleFilterChange(next)}
            onReset={() => void handleFilterReset()}
          />
        ) : null}

        {error ? (
          <YStack
            padding="$3"
            borderRadius={12}
            borderWidth={1}
            borderColor="#FECACA"
            backgroundColor="#FEF2F2"
          >
            <Text fontSize={13} color="#B91C1C">
              {error}
            </Text>
          </YStack>
        ) : null}

        {initialLoading ? (
          <YStack minHeight={280} alignItems="center" justifyContent="center">
            <Spinner size="large" />
          </YStack>
        ) : (
          <>
            <SalesAnalyticsSummaryCards
              ui={ui}
              cards={summaryCards}
              loading={loading.summary}
              isDesktop={isDesktop}
            />

            <SalesAnalyticsHubTabs ui={ui} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === 'overview' ? (
              <YStack gap="$4">
                <SalesAnalyticsTrendPanel
                  ui={ui}
                  trendPoints={trendPoints}
                  categoryPoints={categoryPoints}
                  loading={loading.analytics}
                  formatAmount={formatAmount}
                />
                <XStack gap="$4" flexWrap="wrap" alignItems="stretch">
                  <YStack flex={1} minWidth={280} gap="$2">
                    <Text fontSize={15} fontWeight="800" color={ui.text}>
                      Top products
                    </Text>
                    <SalesAnalyticsTopProductsPanel
                      ui={ui}
                      products={topProducts}
                      loading={loading.topProducts}
                      formatAmount={formatAmount}
                      limit={5}
                      showViewAll
                      onViewAll={() => setActiveTab('products')}
                    />
                  </YStack>
                  <YStack flex={1} minWidth={280} gap="$2">
                    <Text fontSize={15} fontWeight="800" color={ui.text}>
                      Top regions
                    </Text>
                    <SalesAnalyticsRegionalPanel
                      ui={ui}
                      regions={regionalSales}
                      loading={loading.regionalSales}
                      formatAmount={formatAmount}
                      limit={5}
                      showViewAll
                      onViewAll={() => setActiveTab('regional')}
                    />
                  </YStack>
                </XStack>
              </YStack>
            ) : null}

            {activeTab === 'detailed' ? (
              <SalesAnalyticsRecordsList
                ui={ui}
                records={detailedRecords}
                pagination={pagination}
                loading={loading.detailedRecords}
                formatAmount={formatAmount}
                onLoadMore={() => void handleLoadMoreRecords()}
              />
            ) : null}

            {activeTab === 'products' ? (
              <SalesAnalyticsTopProductsPanel
                ui={ui}
                products={topProducts}
                loading={loading.topProducts}
                formatAmount={formatAmount}
              />
            ) : null}

            {activeTab === 'regional' ? (
              <SalesAnalyticsRegionalPanel
                ui={ui}
                regions={regionalSales}
                loading={loading.regionalSales}
                formatAmount={formatAmount}
              />
            ) : null}
          </>
        )}
      </YStack>
    </SalesAnalyticsErrorBoundary>
  )
}
