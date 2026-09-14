import { useCallback, useEffect, useState } from 'react'
import { AppLink } from '~/components/navigation/AppLink'

import {
  SPONSORED_STATUS_LABELS,
  sponsoredAdminAction,
  sponsoredCampaignCtr,
  type SponsoredCampaign,
} from '~/community/lib/sponsored-ads'
import { Button, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { formatCurrency } from '~/lib/format'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function AdminSponsoredAdsManager() {
  const ui = useAppUi()
  const toast = useAppToast()
  const [campaigns, setCampaigns] = useState<SponsoredCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await sponsoredAdminAction('list')
    setCampaigns(result.data?.campaigns ?? [])
    setError(result.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(
    campaign: SponsoredCampaign,
    action: 'approve' | 'reject' | 'pause' | 'refund',
  ) {
    const reason =
      action === 'reject'
        ? window.prompt('Reason shown to the advertiser:')?.trim()
        : action === 'refund'
          ? window.prompt('Optional support note for the PayU refund:')?.trim() || 'Approved by staff'
          : undefined
    if (action === 'reject' && !reason) return

    setActingId(campaign.id)
    const result = await sponsoredAdminAction(action, campaign.id, reason)
    setActingId(null)
    if (result.error) {
      toast.show('Could not update campaign', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Campaign updated', { tone: 'success' })
    await load()
  }

  return (
    <YStack gap="$4" padding="$5">
      <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontSize={24} fontWeight="800" color={ui.text}>
            Sponsored Ads
          </Text>
          <Text color={ui.textSecondary}>
            Review creative, control delivery, and reconcile campaign support.
          </Text>
        </YStack>
        <Button tone="outline" onPress={load}>
          Refresh
        </Button>
      </XStack>

      {loading ? (
        <YStack padding="$8" alignItems="center">
          <Spinner size="large" />
        </YStack>
      ) : error ? (
        <Text color={ui.danger}>{error}</Text>
      ) : campaigns.length === 0 ? (
        <Text color={ui.textSecondary}>No campaigns require review.</Text>
      ) : (
        <YStack gap="$3">
          {campaigns.map((campaign) => (
            <YStack
              key={campaign.id}
              gap="$3"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor={ui.border}
              backgroundColor={ui.surface}
            >
              <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
                <YStack gap="$1" flex={1} minWidth={220}>
                  <Text fontSize={17} fontWeight="700" color={ui.text}>
                    {campaign.name}
                  </Text>
                  <Text fontSize={13} color={ui.textSecondary}>
                    {SPONSORED_STATUS_LABELS[campaign.status]} · {campaign.objective} ·{' '}
                    {formatCurrency(campaign.total_budget, campaign.currency)}
                  </Text>
                </YStack>
                <AppLink href={communityRoutes.post(campaign.post_id)} asChild>
                  <Button tone="outline" size="$3">
                    Review post
                  </Button>
                </AppLink>
              </XStack>

              <XStack gap="$4" flexWrap="wrap">
                <Text color={ui.textSecondary}>
                  {campaign.impression_count.toLocaleString()} impressions
                </Text>
                <Text color={ui.textSecondary}>
                  {campaign.click_count.toLocaleString()} clicks
                </Text>
                <Text color={ui.textSecondary}>
                  {sponsoredCampaignCtr(campaign).toFixed(2)}% CTR
                </Text>
                <Text color={ui.textSecondary}>
                  {formatCurrency(campaign.spent_amount, campaign.currency)} spent
                </Text>
              </XStack>

              {campaign.rejection_reason ? (
                <Text color={ui.danger}>Review note: {campaign.rejection_reason}</Text>
              ) : null}

              <XStack gap="$2" flexWrap="wrap">
                {campaign.status === 'pending_review' ? (
                  <>
                    <Button
                      tone="primary"
                      size="$3"
                      disabled={actingId === campaign.id}
                      onPress={() => act(campaign, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      tone="outline"
                      size="$3"
                      disabled={actingId === campaign.id}
                      onPress={() => act(campaign, 'reject')}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
                {campaign.status === 'active' ? (
                  <Button
                    tone="outline"
                    size="$3"
                    disabled={actingId === campaign.id}
                    onPress={() => act(campaign, 'pause')}
                  >
                    Pause delivery
                  </Button>
                ) : null}
                {campaign.status === 'refund_requested' ? (
                  <Button
                    tone="primary"
                    size="$3"
                    disabled={actingId === campaign.id}
                    onPress={() => act(campaign, 'refund')}
                  >
                    Refund unspent budget
                  </Button>
                ) : null}
              </XStack>
            </YStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
