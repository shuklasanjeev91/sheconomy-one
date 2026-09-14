import { useEffect, useMemo, useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import {
  SPONSORED_STATUS_LABELS,
  fetchSponsoredCampaign,
  fetchSponsoredMetrics,
  sponsoredCampaignCtr,
  type SponsoredCampaign,
  type SponsoredDailyMetric,
} from '~/community/lib/sponsored-ads'
import { Button, Spinner, Text, XStack, YStack } from '~/components/ui'
import { formatCurrency } from '~/lib/format'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function SponsoredCampaignDetailScreen({ campaignId }: { campaignId: string }) {
  const ui = useAppUi()
  const [campaign, setCampaign] = useState<SponsoredCampaign | null>(null)
  const [metrics, setMetrics] = useState<SponsoredDailyMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    void Promise.all([
      fetchSponsoredCampaign(campaignId),
      fetchSponsoredMetrics(campaignId),
    ]).then(([campaignResult, metricsResult]) => {
      if (!active) return
      setCampaign(campaignResult.data)
      setMetrics(metricsResult.data ?? [])
      setError(campaignResult.error ?? metricsResult.error)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [campaignId])

  const maxImpressions = useMemo(
    () => Math.max(1, ...metrics.map((metric) => metric.impressions)),
    [metrics],
  )

  return (
    <CommunityShell>
      <CommunityPageHeader
        title={campaign?.name ?? 'Campaign results'}
        subtitle={campaign ? SPONSORED_STATUS_LABELS[campaign.status] : 'Sponsored post analytics'}
        actions={
          <AppLink href={communityRoutes.ads} asChild>
            <Button tone="outline">Ads Manager</Button>
          </AppLink>
        }
      />

      {loading ? (
        <YStack padding="$8" alignItems="center">
          <Spinner size="large" />
        </YStack>
      ) : error || !campaign ? (
        <Text color={ui.danger}>{error ?? 'Campaign not found.'}</Text>
      ) : (
        <YStack gap="$4" paddingBottom="$6">
          <XStack gap="$3" flexWrap="wrap">
            <Stat label="Impressions" value={campaign.impression_count.toLocaleString()} />
            <Stat label="Clicks" value={campaign.click_count.toLocaleString()} />
            <Stat label="CTR" value={`${sponsoredCampaignCtr(campaign).toFixed(2)}%`} />
            <Stat
              label="Spent"
              value={formatCurrency(campaign.spent_amount, campaign.currency)}
            />
          </XStack>

          <YStack
            gap="$3"
            padding="$4"
            borderRadius="$4"
            borderWidth={1}
            borderColor={ui.border}
            backgroundColor={ui.surface}
          >
            <Text fontSize={17} fontWeight="700" color={ui.text}>
              Daily delivery
            </Text>
            {metrics.length ? (
              metrics.map((metric) => (
                <YStack key={metric.metric_date} gap="$1.5">
                  <XStack justifyContent="space-between" gap="$3">
                    <Text fontSize={13} color={ui.textSecondary}>
                      {new Date(`${metric.metric_date}T00:00:00`).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text fontSize={13} fontWeight="600" color={ui.text}>
                      {metric.impressions.toLocaleString()} impressions · {metric.clicks} clicks
                    </Text>
                  </XStack>
                  <YStack height={8} borderRadius={999} backgroundColor={ui.surfaceMuted}>
                    <YStack
                      height={8}
                      borderRadius={999}
                      width={`${Math.max(2, (metric.impressions / maxImpressions) * 100)}%`}
                      backgroundColor={ui.brand}
                    />
                  </YStack>
                </YStack>
              ))
            ) : (
              <Text color={ui.textSecondary}>Delivery data will appear after approval.</Text>
            )}
          </YStack>

          <YStack
            gap="$2"
            padding="$4"
            borderRadius="$4"
            borderWidth={1}
            borderColor={ui.border}
            backgroundColor={ui.surface}
          >
            <Text fontSize={17} fontWeight="700" color={ui.text}>
              Campaign details
            </Text>
            <Detail label="Objective" value={campaign.objective} />
            <Detail
              label="Budget"
              value={`${formatCurrency(campaign.total_budget, campaign.currency)} total · ${formatCurrency(campaign.daily_budget, campaign.currency)} daily`}
            />
            <Detail
              label="Schedule"
              value={`${new Date(campaign.starts_at).toLocaleDateString('en-IN')} – ${new Date(campaign.ends_at).toLocaleDateString('en-IN')}`}
            />
            <Detail label="Frequency cap" value={`${campaign.frequency_cap_per_day} per person/day`} />
            {campaign.rejection_reason ? (
              <Detail label="Review note" value={campaign.rejection_reason} />
            ) : null}
          </YStack>
        </YStack>
      )}
    </CommunityShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const ui = useAppUi()
  return (
    <YStack
      flex={1}
      minWidth={135}
      gap="$1"
      padding="$4"
      borderRadius="$4"
      borderWidth={1}
      borderColor={ui.border}
      backgroundColor={ui.surface}
    >
      <Text fontSize={12} color={ui.textMuted}>
        {label}
      </Text>
      <Text fontSize={22} fontWeight="800" color={ui.text}>
        {value}
      </Text>
    </YStack>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  const ui = useAppUi()
  return (
    <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
      <Text color={ui.textMuted}>{label}</Text>
      <Text color={ui.text} fontWeight="600" textTransform="capitalize">
        {value}
      </Text>
    </XStack>
  )
}
