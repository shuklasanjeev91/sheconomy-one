import { AppLink } from '~/components/navigation/AppLink'

import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import { useSponsoredCampaigns } from '~/community/hooks/useSponsoredCampaigns'
import {
  SPONSORED_STATUS_LABELS,
  sponsoredCampaignCtr,
  type SponsoredCampaign,
} from '~/community/lib/sponsored-ads'
import { Button, Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { formatCurrency } from '~/lib/format'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function SponsoredAdsManagerScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { campaigns, isLoading, actingId, error, refresh, changeStatus } =
    useSponsoredCampaigns()

  async function act(
    campaign: SponsoredCampaign,
    action: 'pause' | 'resume' | 'cancel' | 'request_refund',
  ) {
    const result = await changeStatus(campaign.id, action)
    if (result.error) {
      toast.show('Could not update campaign', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Campaign updated', { tone: 'success' })
  }

  return (
    <CommunityShell>
      <CommunityPageHeader
        title="Ads Manager"
        subtitle="Manage sponsored posts, budgets, delivery, and results."
        actions={
          <AppLink href={communityRoutes.home} asChild>
            <Button tone="primary" icon={Icons.Megaphone}>
              Choose a post to boost
            </Button>
          </AppLink>
        }
      />

      {campaigns.some((campaign) =>
        ['draft', 'pending_payment', 'rejected'].includes(campaign.status)
      ) ? (
        <YStack
          gap="$2"
          padding="$4"
          borderRadius="$4"
          borderWidth={1}
          borderColor={ui.border}
          backgroundColor={ui.surfaceMuted}
        >
          <Text fontWeight="700" color={ui.text}>
            Some campaigns are waiting to go live
          </Text>
          <Text color={ui.textSecondary} lineHeight={21}>
            Delivery starts after prepaid budget is confirmed and review is approved. You can edit
            unfinished campaigns, then pause, resume, and view results in this app.
          </Text>
        </YStack>
      ) : null}

      {isLoading ? (
        <YStack padding="$8" alignItems="center">
          <Spinner size="large" />
        </YStack>
      ) : error && !campaigns.length ? (
        <YStack gap="$3" padding="$5" alignItems="center">
          <Text color={ui.danger}>{error}</Text>
          <Button tone="outline" onPress={refresh}>
            Retry
          </Button>
        </YStack>
      ) : campaigns.length === 0 ? (
        <YStack
          gap="$3"
          padding="$6"
          alignItems="center"
          borderRadius="$4"
          borderWidth={1}
          borderColor={ui.border}
          backgroundColor={ui.surface}
        >
          <Icons.Megaphone size={42} color={ui.textMuted} />
          <Text fontSize={20} fontWeight="700" color={ui.text}>
            No campaigns yet
          </Text>
          <Text color={ui.textSecondary} textAlign="center">
            Open one of your posts and choose Boost post to create a campaign.
          </Text>
        </YStack>
      ) : (
        <YStack gap="$3">
          {campaigns.map((campaign) => (
            <CampaignRow
              key={campaign.id}
              campaign={campaign}
              busy={actingId === campaign.id}
              onAction={act}
            />
          ))}
        </YStack>
      )}
    </CommunityShell>
  )
}

function CampaignRow({
  campaign,
  busy,
  onAction,
}: {
  campaign: SponsoredCampaign
  busy: boolean
  onAction: (
    campaign: SponsoredCampaign,
    action: 'pause' | 'resume' | 'cancel' | 'request_refund',
  ) => void
}) {
  const ui = useAppUi()
  const remaining = Math.max(0, campaign.total_budget - campaign.spent_amount)

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius="$4"
      borderWidth={1}
      borderColor={ui.border}
      backgroundColor={ui.surface}
    >
      <XStack justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack flex={1} minWidth={180} gap="$1">
          <AppLink href={communityRoutes.adCampaign(campaign.id)} asChild>
            <Text fontSize={17} fontWeight="700" color={ui.text} cursor="pointer">
              {campaign.name}
            </Text>
          </AppLink>
          <Text color={ui.textSecondary} fontSize={13}>
            {SPONSORED_STATUS_LABELS[campaign.status]} · {campaign.objective}
          </Text>
        </YStack>
        <StatusPill status={campaign.status} />
      </XStack>

      <XStack gap="$4" flexWrap="wrap">
        <Metric label="Impressions" value={campaign.impression_count.toLocaleString()} />
        <Metric label="Clicks" value={campaign.click_count.toLocaleString()} />
        <Metric label="CTR" value={`${sponsoredCampaignCtr(campaign).toFixed(2)}%`} />
        <Metric label="Remaining" value={formatCurrency(remaining, campaign.currency)} />
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        <AppLink href={communityRoutes.adCampaign(campaign.id)} asChild>
          <Button tone="outline" size="$3">
            View results
          </Button>
        </AppLink>
        {campaign.status === 'active' ? (
          <Button tone="outline" size="$3" disabled={busy} onPress={() => onAction(campaign, 'pause')}>
            Pause
          </Button>
        ) : null}
        {campaign.status === 'paused' ? (
          <Button tone="primary" size="$3" disabled={busy} onPress={() => onAction(campaign, 'resume')}>
            Resume
          </Button>
        ) : null}
        {['draft', 'pending_payment', 'rejected'].includes(campaign.status) ? (
          <AppLink
            href={`${communityRoutes.boostPost(campaign.post_id)}?campaign=${encodeURIComponent(campaign.id)}` as never}
            asChild
          >
            <Button tone="primary" size="$3">
              Finish setup
            </Button>
          </AppLink>
        ) : null}
        {['draft', 'pending_payment', 'pending_review', 'rejected'].includes(campaign.status) ? (
          <Button
            tone="ghost"
            size="$3"
            disabled={busy}
            onPress={() => onAction(campaign, 'cancel')}
          >
            Cancel
          </Button>
        ) : null}
        {['active', 'paused', 'completed'].includes(campaign.status) &&
        campaign.spent_amount < campaign.total_budget ? (
          <Button
            tone="ghost"
            size="$3"
            disabled={busy}
            onPress={() => onAction(campaign, 'request_refund')}
          >
            Request refund
          </Button>
        ) : null}
      </XStack>
    </YStack>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  const ui = useAppUi()
  return (
    <YStack minWidth={92} gap={2}>
      <Text fontSize={12} color={ui.textMuted}>
        {label}
      </Text>
      <Text fontWeight="700" color={ui.text}>
        {value}
      </Text>
    </YStack>
  )
}

function StatusPill({ status }: { status: SponsoredCampaign['status'] }) {
  const ui = useAppUi()
  const active = status === 'active'
  const warning = ['pending_payment', 'pending_review', 'refund_requested'].includes(status)
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical="$1.5"
      borderRadius={999}
      backgroundColor={
        active ? ui.badgeSuccessBg : warning ? ui.badgeInfoBg : ui.badgeNeutralBg
      }
    >
      <Text
        fontSize={12}
        fontWeight="700"
        color={active ? ui.badgeSuccessText : warning ? ui.badgeInfoText : ui.badgeNeutralText}
      >
        {SPONSORED_STATUS_LABELS[status]}
      </Text>
    </XStack>
  )
}
