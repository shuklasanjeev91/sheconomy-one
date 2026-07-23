import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'

import {
  Button,
  Icons,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'
import {
  fetchVendorInquiries,
  fetchVendorReviews,
  replyToVendorInquiry,
  replyToVendorReview,
  rowsToCsv,
  type VendorInquiry,
  type VendorReview,
} from '~/commerce/lib/vendor-operations'

export type VendorOperationsKind = 'reviews'

export function VendorOperationsScreen({ kind }: { kind: VendorOperationsKind }) {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const toast = useAppToast()
  const shop = useAppSelector((state) => state.shop.currentShop)
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<VendorReview[]>([])
  const [inquiries, setInquiries] = useState<VendorInquiry[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!shop?.id) return
    setLoading(true)
    try {
      if (kind === 'reviews') {
        const [reviewRows, inquiryRows] = await Promise.all([
          fetchVendorReviews(shop.id),
          fetchVendorInquiries(shop.id),
        ])
        setReviews(reviewRows)
        setInquiries(inquiryRows)
      }
    } catch (error) {
      toast.show('Could not load seller data', {
        tone: 'danger',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [kind, shop?.id, toast])

  useEffect(() => {
    void load()
  }, [load])

  const title = useMemo(
    () =>
      ({
        reviews: 'Reviews & inquiries',
      })[kind],
    [kind],
  )

  const openInquiries = useMemo(
    () => inquiries.filter((row) => row.status !== 'closed'),
    [inquiries],
  )
  const closedInquiries = useMemo(
    () => inquiries.filter((row) => row.status === 'closed'),
    [inquiries],
  )

  async function exportRows() {
    const rows = [...reviews, ...inquiries]
    const csv = rowsToCsv(rows as unknown as Array<Record<string, unknown>>)
    if (!csv) {
      toast.show('No data to export', { tone: 'info' })
      return
    }
    await Share.share({ title: `${title} export`, message: csv })
  }

  async function submitReply(type: 'review' | 'inquiry', id: string, close = false) {
    const reply = drafts[id]?.trim() ?? ''
    if (!reply) return
    const error =
      type === 'review'
        ? await replyToVendorReview(id, reply)
        : await replyToVendorInquiry(id, reply, close)
    if (error) {
      toast.show('Could not send reply', { tone: 'danger', message: error })
      return
    }
    setDrafts((current) => ({ ...current, [id]: '' }))
    toast.show(close ? 'Inquiry closed' : 'Reply sent', { tone: 'success' })
    await load()
  }

  if (!shop) {
    return (
      <YStack minHeight={360} alignItems="center" justifyContent="center" gap="$2">
        <Icons.Store size={30} color={ui.textMuted} />
        <Text color={ui.text}>Create a shop to use seller operations.</Text>
      </YStack>
    )
  }

  return (
    <YStack
      width="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontSize={isDesktop ? 28 : 23} fontWeight="800" color={ui.text}>
            {title}
          </Text>
          <Text fontSize={13} color={ui.textSecondary}>
            Live operational data for {shop.shop_name}.
          </Text>
        </YStack>
        <Button tone="outline" size="$3" icon={<Icons.Download size={15} />} onPress={exportRows}>
          Export CSV
        </Button>
      </XStack>

      {loading ? (
        <YStack minHeight={280} alignItems="center" justifyContent="center">
          <Spinner size="large" />
        </YStack>
      ) : null}

      {!loading ? (
        <>
          <Panel title="Product reviews">
            {reviews.length ? (
              reviews.map((review) => (
                <YStack
                  key={review.id}
                  gap="$2"
                  paddingVertical="$2"
                  borderBottomWidth={1}
                  borderBottomColor={ui.borderSubtle}
                >
                  <Text fontSize={13} fontWeight="800" color={ui.text}>
                    {review.rating}★ · {review.listingTitle}
                    {review.verified ? ' · Verified' : ''}
                  </Text>
                  <Text fontSize={13} color={ui.textSecondary}>
                    {review.text}
                  </Text>
                  {review.vendorReply ? (
                    <Text fontSize={12} color={ui.textMuted}>
                      Your reply: {review.vendorReply}
                    </Text>
                  ) : (
                    <XStack gap="$2" alignItems="flex-end" flexWrap="wrap">
                      <TextArea
                        flex={1}
                        minWidth={220}
                        value={drafts[review.id] ?? ''}
                        onChangeText={(value) =>
                          setDrafts((current) => ({ ...current, [review.id]: value }))
                        }
                        placeholder="Write a public reply…"
                      />
                      <Button
                        tone="primary"
                        size="$3"
                        disabled={!(drafts[review.id] ?? '').trim()}
                        onPress={() => void submitReply('review', review.id)}
                      >
                        Reply
                      </Button>
                    </XStack>
                  )}
                </YStack>
              ))
            ) : (
              <Empty text="No product reviews yet." />
            )}
          </Panel>
          <Panel title="Open buyer inquiries">
            {openInquiries.length ? (
              openInquiries.map((inquiry) => (
                <YStack
                  key={inquiry.id}
                  gap="$2"
                  paddingVertical="$2"
                  borderBottomWidth={1}
                  borderBottomColor={ui.borderSubtle}
                >
                  <Text fontSize={13} fontWeight="800" color={ui.text}>
                    Inquiry · {inquiry.status}
                  </Text>
                  <Text fontSize={13} color={ui.textSecondary}>
                    {inquiry.message}
                  </Text>
                  {inquiry.reply ? (
                    <Text fontSize={12} color={ui.textMuted}>
                      Your reply: {inquiry.reply}
                    </Text>
                  ) : null}
                  <XStack gap="$2" alignItems="flex-end" flexWrap="wrap">
                    <TextArea
                      flex={1}
                      minWidth={220}
                      value={drafts[inquiry.id] ?? ''}
                      onChangeText={(value) =>
                        setDrafts((current) => ({ ...current, [inquiry.id]: value }))
                      }
                      placeholder="Reply to the buyer…"
                    />
                    <Button
                      tone="primary"
                      size="$3"
                      disabled={!(drafts[inquiry.id] ?? '').trim()}
                      onPress={() => void submitReply('inquiry', inquiry.id)}
                    >
                      Reply
                    </Button>
                    <Button
                      tone="outline"
                      size="$3"
                      disabled={!(drafts[inquiry.id] ?? '').trim()}
                      onPress={() => void submitReply('inquiry', inquiry.id, true)}
                    >
                      Reply & close
                    </Button>
                  </XStack>
                </YStack>
              ))
            ) : (
              <Empty text="No open buyer inquiries." />
            )}
          </Panel>
          {closedInquiries.length ? (
            <Panel title="Closed inquiries">
              {closedInquiries.slice(0, 20).map((inquiry) => (
                <Row
                  key={inquiry.id}
                  title={inquiry.message.slice(0, 80)}
                  subtitle={inquiry.reply ? `Reply: ${inquiry.reply.slice(0, 80)}` : 'Closed'}
                  trailing={inquiry.status}
                />
              ))}
            </Panel>
          ) : null}
        </>
      ) : null}
    </YStack>
  )
}


function Panel({ title, children }: { title: string; children: ReactNode }) {
  const ui = useAppUi()
  return (
    <YStack
      padding="$4"
      gap="$3"
      borderWidth={1}
      borderColor={ui.borderSubtle}
      borderRadius={radius.card}
      backgroundColor={ui.surface}
    >
      <Text fontSize={16} fontWeight="800" color={ui.text}>
        {title}
      </Text>
      {children}
    </YStack>
  )
}

function Row({
  title,
  subtitle,
  trailing,
}: {
  title: string
  subtitle: string
  trailing: string
}) {
  const ui = useAppUi()
  return (
    <XStack gap="$3" alignItems="center" justifyContent="space-between" paddingVertical="$2">
      <YStack flex={1} minWidth={0}>
        <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
          {title}
        </Text>
        <Text fontSize={12} color={ui.textMuted}>
          {subtitle}
        </Text>
      </YStack>
      <Text fontSize={12} fontWeight="700" color={ui.textSecondary}>
        {trailing}
      </Text>
    </XStack>
  )
}

function Empty({ text }: { text: string }) {
  const ui = useAppUi()
  return (
    <Text fontSize={13} color={ui.textMuted} paddingVertical="$4">
      {text}
    </Text>
  )
}
