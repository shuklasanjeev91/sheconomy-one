import { useCallback, useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'

import { ShopReviewErrorBoundary } from '~/commerce/components/ShopReviewErrorBoundary'
import { ShopReviewFilterTabs } from '~/commerce/components/vendor/shop-review/ShopReviewFilterTabs'
import { ShopReviewListItem } from '~/commerce/components/vendor/shop-review/ShopReviewListItem'
import { ShopReviewOverviewPanel } from '~/commerce/components/vendor/shop-review/ShopReviewOverviewPanel'
import { ShopReviewResponseDrawer } from '~/commerce/components/vendor/shop-review/ShopReviewResponseDrawer'
import { ShopReviewSearchField } from '~/commerce/components/vendor/shop-review/ShopReviewSearchField'
import { ShopReviewSummaryCards } from '~/commerce/components/vendor/shop-review/ShopReviewSummaryCards'
import { rowsToCsv } from '~/commerce/lib/vendor-operations'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAuth } from '~/hooks/useAuth'
import { SHOP_REVIEW_STATUS, SHOP_REVIEW_VALIDATION } from '~/lib/shop-review/shop-review.constants'
import { toFriendlyShopReviewError } from '~/lib/shop-review/shop-review.errors'
import { SHOP_REVIEW_UI_COPY } from '~/lib/shop-review/shop-review-ui.copy'
import {
  buildShopReviewExportRows,
  computeShopReviewHubStats,
  filterShopReviewsByTab,
  filterShopReviewsForHub,
  getShopReviewHubTabs,
  type ShopReviewHubTab,
} from '~/lib/shop-review/shop-review-ui.utils'
import type { ShopReviewWithRelations } from '~/lib/shop-review/shop-review.type'
import { canRespondToShopReview } from '~/lib/shop-review/shop-review.utils'
import {
  createShopReviewResponse,
  loadShopOwnerReviews,
  loadShopReviewStats,
  moderateShopReviews,
  selectShopOwnerReviews,
  selectShopReviewStats,
  setShopReviewFetchScope,
  setShopReviewShopId,
} from '~/lib/shop-review/shop-review.store'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type VendorShopReviewsHubPanelProps = {
  ui: AppUiTokens
  shopId: string
  shopName?: string | null
  isDesktop: boolean
  safeBottom: number
}

function EmptyState({ ui, title, body }: { ui: AppUiTokens; title: string; body: string }) {
  return (
    <YStack alignItems="center" justifyContent="center" paddingVertical="$8" gap="$2">
      <Icons.MessageSquare size={32} color={ui.textMuted} />
      <Text fontSize={16} fontWeight="800" color={ui.text}>
        {title}
      </Text>
      <Text fontSize={13} color={ui.textSecondary} textAlign="center" maxWidth={360} lineHeight={20}>
        {body}
      </Text>
    </YStack>
  )
}

export function VendorShopReviewsHubPanel({
  ui,
  shopId,
  shopName,
  isDesktop,
  safeBottom,
}: VendorShopReviewsHubPanelProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { user } = useAuth()

  const ownerReviews = useAppSelector(selectShopOwnerReviews)
  const reviewStats = useAppSelector(selectShopReviewStats)
  const isResponding = useAppSelector((state) => state.shopReview.isResponding)
  const isModerating = useAppSelector((state) => state.shopReview.isModerating)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<ShopReviewHubTab>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<ShopReviewWithRelations | null>(null)

  const refreshReviews = useCallback(async () => {
    await Promise.all([
      dispatch(
        loadShopOwnerReviews({
          shopId,
          limit: SHOP_REVIEW_VALIDATION.PAGINATION.MAX,
        }),
      ).unwrap(),
      dispatch(loadShopReviewStats({ shopId, forceRefresh: true })).unwrap(),
    ])
  }, [dispatch, shopId])

  useEffect(() => {
    if (!shopId) return
    dispatch(setShopReviewShopId(shopId))
    dispatch(setShopReviewFetchScope('management'))
    setLoading(true)
    void refreshReviews()
      .catch((error) => {
        toast.show(SHOP_REVIEW_UI_COPY.loadError, {
          tone: 'danger',
          message: toFriendlyShopReviewError(error),
        })
      })
      .finally(() => setLoading(false))
  }, [dispatch, refreshReviews, shopId, toast])

  const stats = useMemo(() => computeShopReviewHubStats(ownerReviews), [ownerReviews])
  const tabs = useMemo(() => getShopReviewHubTabs(stats), [stats])

  const tabReviews = useMemo(
    () => filterShopReviewsByTab(ownerReviews, activeTab === 'overview' ? 'all' : activeTab),
    [ownerReviews, activeTab],
  )

  const filteredReviews = useMemo(
    () => filterShopReviewsForHub(ownerReviews, activeTab, searchQuery),
    [ownerReviews, activeTab, searchQuery],
  )

  const hasSearchQuery = searchQuery.trim().length > 0

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refreshReviews()
    } catch (error) {
      toast.show(SHOP_REVIEW_UI_COPY.loadError, {
        tone: 'danger',
        message: toFriendlyShopReviewError(error),
      })
    } finally {
      setRefreshing(false)
    }
  }

  async function handleExport() {
    try {
      const rows = buildShopReviewExportRows(filteredReviews.length ? filteredReviews : ownerReviews)
      const csv = rowsToCsv(rows)
      await Share.share({
        title: `${shopName ?? 'Shop'} reviews`,
        message: csv,
      })
      toast.show(SHOP_REVIEW_UI_COPY.exportSuccess, { tone: 'success' })
    } catch (error) {
      toast.show(SHOP_REVIEW_UI_COPY.exportFailed, {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  function openRespondDrawer(review: ShopReviewWithRelations) {
    setSelectedReview(review)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    if (isResponding || isModerating) return
    setDrawerOpen(false)
    setSelectedReview(null)
  }

  async function handleSubmitResponse(responseText: string) {
    if (!selectedReview) return
    try {
      await dispatch(
        createShopReviewResponse({
          input: {
            review_id: selectedReview.id,
            response_text: responseText,
            is_public: true,
          },
        }),
      ).unwrap()
      toast.show(SHOP_REVIEW_UI_COPY.respondSuccess, { tone: 'success' })
      closeDrawer()
    } catch (error) {
      toast.show(SHOP_REVIEW_UI_COPY.respondFailed, {
        tone: 'danger',
        message: toFriendlyShopReviewError(error),
      })
    }
  }

  async function handleModerate(review: ShopReviewWithRelations, status: typeof SHOP_REVIEW_STATUS.APPROVED | typeof SHOP_REVIEW_STATUS.REJECTED) {
    try {
      await dispatch(
        moderateShopReviews({
          reviewIds: [review.id],
          updates: { review_status: status },
        }),
      ).unwrap()
      toast.show(SHOP_REVIEW_UI_COPY.moderateSuccess, { tone: 'success' })
      if (drawerOpen && selectedReview?.id === review.id) closeDrawer()
    } catch (error) {
      toast.show(SHOP_REVIEW_UI_COPY.moderateFailed, {
        tone: 'danger',
        message: toFriendlyShopReviewError(error),
      })
    }
  }

  if (loading && ownerReviews.length === 0) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$6">
        <Spinner size="small" />
        <Text fontSize={13} color={ui.textMuted}>
          {SHOP_REVIEW_UI_COPY.loading}
        </Text>
      </XStack>
    )
  }

  return (
    <ShopReviewErrorBoundary
      scope="VendorShopReviewsHub"
      title={SHOP_REVIEW_UI_COPY.hubErrorTitle}
      onReset={() => void handleRefresh()}
    >
      <YStack gap="$5" width="100%" maxWidth={1200} alignSelf="center">
        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={220} gap="$1">
            <Text fontSize={isDesktop ? 22 : 20} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
              {shopName ? `Manage and respond to reviews for ${shopName}` : SHOP_REVIEW_UI_COPY.pageSubtitle}
            </Text>
          </YStack>
          <XStack gap="$2" flexWrap="wrap">
            <Button
              size="$3"
              borderRadius={999}
              tone="outline"
              icon={refreshing ? <Spinner size="small" /> : <Icons.RefreshCw size={15} />}
              disabled={refreshing}
              onPress={() => void handleRefresh()}
            >
              {SHOP_REVIEW_UI_COPY.refresh}
            </Button>
            <Button
              size="$3"
              borderRadius={999}
              tone="outline"
              icon={<Icons.Download size={15} />}
              onPress={() => void handleExport()}
            >
              {SHOP_REVIEW_UI_COPY.export}
            </Button>
          </XStack>
        </XStack>

        <ShopReviewSummaryCards ui={ui} stats={stats} isDesktop={isDesktop} />

        <ShopReviewFilterTabs ui={ui} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab !== 'overview' ? (
          <ShopReviewSearchField
            ui={ui}
            value={searchQuery}
            onChange={setSearchQuery}
            resultCount={filteredReviews.length}
            totalCount={tabReviews.length}
          />
        ) : null}

        {activeTab === 'overview' ? (
          <ShopReviewOverviewPanel
            ui={ui}
            stats={stats}
            reviewStats={reviewStats}
            recentReviews={ownerReviews}
            isDesktop={isDesktop}
          />
        ) : filteredReviews.length ? (
          <YStack gap="$3">
            {filteredReviews.map((review) => (
              <ShopReviewListItem
                key={review.id}
                ui={ui}
                review={review}
                canRespond={canRespondToShopReview(review, user?.id)}
                onRespond={() => openRespondDrawer(review)}
                onApprove={
                  review.review_status === SHOP_REVIEW_STATUS.PENDING
                    ? () => void handleModerate(review, SHOP_REVIEW_STATUS.APPROVED)
                    : undefined
                }
                onReject={
                  review.review_status === SHOP_REVIEW_STATUS.PENDING
                    ? () => void handleModerate(review, SHOP_REVIEW_STATUS.REJECTED)
                    : undefined
                }
                isModerating={isModerating}
              />
            ))}
          </YStack>
        ) : (
          <EmptyState
            ui={ui}
            title={
              hasSearchQuery
                ? SHOP_REVIEW_UI_COPY.noSearchResults
                : activeTab === 'pending'
                  ? SHOP_REVIEW_UI_COPY.emptyPendingTitle
                  : activeTab === 'responses'
                    ? SHOP_REVIEW_UI_COPY.emptyResponsesTitle
                    : SHOP_REVIEW_UI_COPY.emptyReviewsTitle
            }
            body={
              hasSearchQuery
                ? SHOP_REVIEW_UI_COPY.noSearchResults
                : activeTab === 'pending'
                  ? SHOP_REVIEW_UI_COPY.emptyPendingBody
                  : activeTab === 'responses'
                    ? SHOP_REVIEW_UI_COPY.emptyResponsesBody
                    : SHOP_REVIEW_UI_COPY.emptyReviewsBody
            }
          />
        )}
      </YStack>

      <ShopReviewResponseDrawer
        ui={ui}
        open={drawerOpen}
        isDesktop={isDesktop}
        review={selectedReview}
        submitting={isResponding}
        safeBottom={safeBottom}
        onClose={closeDrawer}
        onSubmit={(text) => void handleSubmitResponse(text)}
        onApprove={
          selectedReview?.review_status === SHOP_REVIEW_STATUS.PENDING
            ? () => void handleModerate(selectedReview, SHOP_REVIEW_STATUS.APPROVED)
            : undefined
        }
        onReject={
          selectedReview?.review_status === SHOP_REVIEW_STATUS.PENDING
            ? () => void handleModerate(selectedReview, SHOP_REVIEW_STATUS.REJECTED)
            : undefined
        }
        isModerating={isModerating}
      />
    </ShopReviewErrorBoundary>
  )
}
