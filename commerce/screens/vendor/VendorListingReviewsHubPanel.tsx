import { useCallback, useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'

import { ListingReviewErrorBoundary } from '~/commerce/components/ListingReviewErrorBoundary'
import { ListingReviewFilterTabs } from '~/commerce/components/vendor/listing-review/ListingReviewFilterTabs'
import { ListingReviewListItem } from '~/commerce/components/vendor/listing-review/ListingReviewListItem'
import { ListingReviewOverviewPanel } from '~/commerce/components/vendor/listing-review/ListingReviewOverviewPanel'
import { ListingReviewResponseDrawer } from '~/commerce/components/vendor/listing-review/ListingReviewResponseDrawer'
import { ListingReviewSearchField } from '~/commerce/components/vendor/listing-review/ListingReviewSearchField'
import { ListingReviewSummaryCards } from '~/commerce/components/vendor/listing-review/ListingReviewSummaryCards'
import { rowsToCsv } from '~/commerce/lib/vendor-operations'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useAuth } from '~/hooks/useAuth'
import { LISTING_REVIEW_STATUS, LISTING_REVIEW_VALIDATION } from '~/lib/listing-reviews/listing-reviews.constants'
import { toFriendlyListingReviewError } from '~/lib/listing-reviews/listing-reviews.errors'
import { LISTING_REVIEW_UI_COPY } from '~/lib/listing-reviews/listing-reviews-ui.copy'
import {
  buildListingReviewExportRows,
  canReplyToListingReview,
  computeListingReviewHubStats,
  filterListingReviewsByTab,
  filterListingReviewsForHub,
  getDefaultVendorListingReviewStatuses,
  getListingReviewHubTabs,
  type ListingReviewHubTab,
} from '~/lib/listing-reviews/listing-reviews-ui.utils'
import type { ListingReviewWithRelations } from '~/lib/listing-reviews/listing-reviews.type'
import {
  createListingReviewReply,
  loadListingReviews,
  moderateListingReviews,
  selectListingReviews,
  setListingReviewFetchScope,
  setListingReviewFilters,
} from '~/lib/listing-reviews/listing-reviews.store'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type VendorListingReviewsHubPanelProps = {
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

export function VendorListingReviewsHubPanel({
  ui,
  shopId,
  shopName,
  isDesktop,
  safeBottom,
}: VendorListingReviewsHubPanelProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { user } = useAuth()

  const reviews = useAppSelector(selectListingReviews)
  const isReplying = useAppSelector((state) => state.listingReviews.isReplying)
  const isModerating = useAppSelector((state) => state.listingReviews.isModerating)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<ListingReviewHubTab>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<ListingReviewWithRelations | null>(null)

  const refreshReviews = useCallback(async () => {
    await dispatch(
      loadListingReviews({
        reset: true,
        scope: 'management',
        forceRefresh: true,
        filters: {
          shop_id: shopId,
          status: getDefaultVendorListingReviewStatuses(),
          limit: LISTING_REVIEW_VALIDATION.FILTER_LIMIT.MAX,
          offset: 0,
        },
      }),
    ).unwrap()
  }, [dispatch, shopId])

  useEffect(() => {
    if (!shopId) return
    dispatch(setListingReviewFetchScope('management'))
    dispatch(
      setListingReviewFilters({
        shop_id: shopId,
        status: getDefaultVendorListingReviewStatuses(),
        limit: LISTING_REVIEW_VALIDATION.FILTER_LIMIT.MAX,
        offset: 0,
      }),
    )
    setLoading(true)
    void refreshReviews()
      .catch((error) => {
        toast.show(LISTING_REVIEW_UI_COPY.loadError, {
          tone: 'danger',
          message: toFriendlyListingReviewError(error),
        })
      })
      .finally(() => setLoading(false))
  }, [dispatch, refreshReviews, shopId, toast])

  const stats = useMemo(() => computeListingReviewHubStats(reviews), [reviews])
  const tabs = useMemo(() => getListingReviewHubTabs(stats), [stats])

  const tabReviews = useMemo(
    () => filterListingReviewsByTab(reviews, activeTab === 'overview' ? 'all' : activeTab),
    [reviews, activeTab],
  )

  const filteredReviews = useMemo(
    () => filterListingReviewsForHub(reviews, activeTab, searchQuery),
    [reviews, activeTab, searchQuery],
  )

  const hasSearchQuery = searchQuery.trim().length > 0

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refreshReviews()
    } catch (error) {
      toast.show(LISTING_REVIEW_UI_COPY.loadError, {
        tone: 'danger',
        message: toFriendlyListingReviewError(error),
      })
    } finally {
      setRefreshing(false)
    }
  }

  async function handleExport() {
    try {
      const rows = buildListingReviewExportRows(filteredReviews.length ? filteredReviews : reviews)
      const csv = rowsToCsv(rows)
      await Share.share({
        title: `${shopName ?? 'Shop'} listing reviews`,
        message: csv,
      })
      toast.show(LISTING_REVIEW_UI_COPY.exportSuccess, { tone: 'success' })
    } catch (error) {
      toast.show(LISTING_REVIEW_UI_COPY.exportFailed, {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  function openRespondDrawer(review: ListingReviewWithRelations) {
    setSelectedReview(review)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    if (isReplying || isModerating) return
    setDrawerOpen(false)
    setSelectedReview(null)
  }

  async function handleSubmitReply(replyText: string) {
    if (!selectedReview) return
    try {
      await dispatch(
        createListingReviewReply({
          input: {
            review_id: selectedReview.id,
            reply_text: replyText,
            is_public: true,
          },
        }),
      ).unwrap()
      toast.show(LISTING_REVIEW_UI_COPY.respondSuccess, { tone: 'success' })
      closeDrawer()
    } catch (error) {
      toast.show(LISTING_REVIEW_UI_COPY.respondFailed, {
        tone: 'danger',
        message: toFriendlyListingReviewError(error),
      })
    }
  }

  async function handleModerate(
    review: ListingReviewWithRelations,
    status: typeof LISTING_REVIEW_STATUS.APPROVED | typeof LISTING_REVIEW_STATUS.REJECTED,
  ) {
    try {
      await dispatch(
        moderateListingReviews({
          input: {
            review_ids: [review.id],
            updates: { review_status: status },
          },
        }),
      ).unwrap()
      toast.show(LISTING_REVIEW_UI_COPY.moderateSuccess, { tone: 'success' })
      if (drawerOpen && selectedReview?.id === review.id) closeDrawer()
    } catch (error) {
      toast.show(LISTING_REVIEW_UI_COPY.moderateFailed, {
        tone: 'danger',
        message: toFriendlyListingReviewError(error),
      })
    }
  }

  if (loading && reviews.length === 0) {
    return (
      <XStack alignItems="center" gap="$2" paddingVertical="$6">
        <Spinner size="small" />
        <Text fontSize={13} color={ui.textMuted}>
          {LISTING_REVIEW_UI_COPY.loading}
        </Text>
      </XStack>
    )
  }

  return (
    <ListingReviewErrorBoundary
      scope="VendorListingReviewsHub"
      title={LISTING_REVIEW_UI_COPY.hubErrorTitle}
      onReset={() => void handleRefresh()}
    >
      <YStack gap="$5" width="100%" maxWidth={1200} alignSelf="center">
        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={220} gap="$1">
            <Text fontSize={isDesktop ? 22 : 20} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
              {shopName
                ? `Manage and respond to listing reviews for ${shopName}`
                : LISTING_REVIEW_UI_COPY.pageSubtitle}
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
              {LISTING_REVIEW_UI_COPY.refresh}
            </Button>
            <Button
              size="$3"
              borderRadius={999}
              tone="outline"
              icon={<Icons.Download size={15} />}
              onPress={() => void handleExport()}
            >
              {LISTING_REVIEW_UI_COPY.export}
            </Button>
          </XStack>
        </XStack>

        <ListingReviewSummaryCards ui={ui} stats={stats} isDesktop={isDesktop} />

        <ListingReviewFilterTabs ui={ui} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab !== 'overview' ? (
          <ListingReviewSearchField
            ui={ui}
            value={searchQuery}
            onChange={setSearchQuery}
            resultCount={filteredReviews.length}
            totalCount={tabReviews.length}
          />
        ) : null}

        {activeTab === 'overview' ? (
          <ListingReviewOverviewPanel ui={ui} stats={stats} reviews={reviews} isDesktop={isDesktop} />
        ) : filteredReviews.length ? (
          <YStack gap="$3">
            {filteredReviews.map((review) => (
              <ListingReviewListItem
                key={review.id}
                ui={ui}
                review={review}
                canReply={canReplyToListingReview(review, user?.id)}
                onRespond={() => openRespondDrawer(review)}
                onApprove={
                  review.review_status === LISTING_REVIEW_STATUS.PENDING
                    ? () => void handleModerate(review, LISTING_REVIEW_STATUS.APPROVED)
                    : undefined
                }
                onReject={
                  review.review_status === LISTING_REVIEW_STATUS.PENDING
                    ? () => void handleModerate(review, LISTING_REVIEW_STATUS.REJECTED)
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
                ? LISTING_REVIEW_UI_COPY.noSearchResults
                : activeTab === 'pending'
                  ? LISTING_REVIEW_UI_COPY.emptyPendingTitle
                  : activeTab === 'responses'
                    ? LISTING_REVIEW_UI_COPY.emptyResponsesTitle
                    : LISTING_REVIEW_UI_COPY.emptyReviewsTitle
            }
            body={
              hasSearchQuery
                ? LISTING_REVIEW_UI_COPY.noSearchResults
                : activeTab === 'pending'
                  ? LISTING_REVIEW_UI_COPY.emptyPendingBody
                  : activeTab === 'responses'
                    ? LISTING_REVIEW_UI_COPY.emptyResponsesBody
                    : LISTING_REVIEW_UI_COPY.emptyReviewsBody
            }
          />
        )}
      </YStack>

      <ListingReviewResponseDrawer
        ui={ui}
        open={drawerOpen}
        isDesktop={isDesktop}
        review={selectedReview}
        submitting={isReplying}
        safeBottom={safeBottom}
        onClose={closeDrawer}
        onSubmit={(text) => void handleSubmitReply(text)}
        onApprove={
          selectedReview?.review_status === LISTING_REVIEW_STATUS.PENDING
            ? () => void handleModerate(selectedReview, LISTING_REVIEW_STATUS.APPROVED)
            : undefined
        }
        onReject={
          selectedReview?.review_status === LISTING_REVIEW_STATUS.PENDING
            ? () => void handleModerate(selectedReview, LISTING_REVIEW_STATUS.REJECTED)
            : undefined
        }
        isModerating={isModerating}
      />
    </ListingReviewErrorBoundary>
  )
}
