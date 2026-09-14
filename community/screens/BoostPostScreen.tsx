import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'one'

import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { CommunityShell } from '~/community/components/CommunityShell'
import { FeedPostCard } from '~/community/components/FeedPostCard'
import { fetchPostById, type CommunityPost } from '~/community/lib/community'
import {
  SPONSORED_MAX_DURATION_DAYS,
  SPONSORED_MIN_DAILY_BUDGET,
  SPONSORED_MIN_TOTAL_BUDGET,
  beginSponsoredPayuCheckout,
  createSponsoredCampaign,
  fetchSponsoredCampaign,
  updateSponsoredCampaign,
  type SponsoredCallToAction,
  type SponsoredObjective,
} from '~/community/lib/sponsored-ads'
import { Button, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { formatCurrency } from '~/lib/format'
import { communityRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

const OBJECTIVES: Array<{ value: SponsoredObjective; label: string; detail: string }> = [
  { value: 'awareness', label: 'More reach', detail: 'Show your post to more relevant people.' },
  { value: 'engagement', label: 'More engagement', detail: 'Optimize for reactions and comments.' },
  { value: 'traffic', label: 'More website visits', detail: 'Send people to your destination URL.' },
]

const CTA_OPTIONS: Array<{ value: SponsoredCallToAction; label: string }> = [
  { value: 'learn_more', label: 'Learn more' },
  { value: 'shop_now', label: 'Shop now' },
  { value: 'sign_up', label: 'Sign up' },
  { value: 'contact_us', label: 'Contact us' },
  { value: 'visit_profile', label: 'Visit profile' },
  { value: 'none', label: 'No button' },
]

export function BoostPostScreen({
  postId,
  campaignId,
}: {
  postId: string
  campaignId?: string
}) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()
  const [post, setPost] = useState<CommunityPost | null>(null)
  const [loadingPost, setLoadingPost] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState('Boosted post')
  const [objective, setObjective] = useState<SponsoredObjective>('awareness')
  const [totalBudget, setTotalBudget] = useState('500')
  const [dailyBudget, setDailyBudget] = useState('100')
  const [durationDays, setDurationDays] = useState('5')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [callToAction, setCallToAction] =
    useState<SponsoredCallToAction>('learn_more')
  const [locations, setLocations] = useState('')
  const [industries, setIndustries] = useState('')
  const [interests, setInterests] = useState('')

  useEffect(() => {
    let active = true
    void fetchPostById(postId).then((result) => {
      if (!active) return
      setPost(result.data)
      if (result.data?.content) {
        setName(result.data.content.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Boosted post')
      }
      setLoadingPost(false)
    })
    return () => {
      active = false
    }
  }, [postId])

  useEffect(() => {
    if (!campaignId) return
    let active = true
    void fetchSponsoredCampaign(campaignId).then((result) => {
      const campaign = result.data
      if (!active || !campaign) return
      setName(campaign.name)
      setObjective(campaign.objective)
      setTotalBudget(String(campaign.total_budget))
      setDailyBudget(String(campaign.daily_budget))
      setDurationDays(
        String(
          Math.max(
            1,
            Math.ceil(
              (new Date(campaign.ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
            ),
          ),
        ),
      )
      setDestinationUrl(campaign.destination_url ?? '')
      setCallToAction(campaign.call_to_action)
      setLocations(campaign.audience.locations?.join(', ') ?? '')
      setIndustries(campaign.audience.industries?.join(', ') ?? '')
      setInterests(campaign.audience.interests?.join(', ') ?? '')
    })
    return () => {
      active = false
    }
  }, [campaignId])

  const estimate = useMemo(() => {
    const budget = Number(totalBudget) || 0
    return Math.max(0, Math.floor(budget / 0.2))
  }, [totalBudget])

  const canCheckout = Platform.OS === 'web'

  async function submit() {
    const budget = Number(totalBudget)
    const daily = Number(dailyBudget)
    const days = Math.floor(Number(durationDays))
    if (!user || !post) return
    if (budget < SPONSORED_MIN_TOTAL_BUDGET || daily < SPONSORED_MIN_DAILY_BUDGET) {
      toast.show('Check your budget', {
        tone: 'danger',
        message: `Minimum total is ₹${SPONSORED_MIN_TOTAL_BUDGET} and minimum daily is ₹${SPONSORED_MIN_DAILY_BUDGET}.`,
      })
      return
    }
    if (daily > budget || days < 1 || days > SPONSORED_MAX_DURATION_DAYS) {
      toast.show('Check campaign duration', {
        tone: 'danger',
        message: `Choose 1–${SPONSORED_MAX_DURATION_DAYS} days and keep daily budget within the total.`,
      })
      return
    }
    if (objective === 'traffic' && !destinationUrl.trim()) {
      toast.show('Destination required', {
        tone: 'danger',
        message: 'Add an HTTPS destination for a traffic campaign.',
      })
      return
    }

    setSubmitting(true)
    const startsAt = new Date()
    const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000)
    const input = {
      postId: post.id,
      name: name.trim() || 'Boosted post',
      objective,
      audience: {
        locations: splitList(locations),
        industries: splitList(industries),
        interests: splitList(interests),
      },
      destinationUrl: destinationUrl.trim() || null,
      callToAction,
      totalBudget: budget,
      dailyBudget: daily,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      frequencyCapPerDay: 3,
    }
    const result = campaignId
      ? await updateSponsoredCampaign(campaignId, input)
      : await createSponsoredCampaign(input)
    if (!result.data?.campaign) {
      setSubmitting(false)
      toast.show('Could not create campaign', {
        tone: 'danger',
        message: result.error ?? 'Please try again.',
      })
      return
    }

    if (!canCheckout) {
      setSubmitting(false)
      toast.show('Campaign saved', {
        tone: 'success',
        message:
          'You can monitor this campaign in Ads Manager. Delivery starts after prepaid budget is confirmed and the campaign is approved.',
      })
      router.replace(communityRoutes.ads)
      return
    }

    const payment = await beginSponsoredPayuCheckout(result.data.campaign.id)
    if (payment.error) {
      setSubmitting(false)
      toast.show('Could not open PayU', { tone: 'danger', message: payment.error })
    }
  }

  return (
    <CommunityShell>
      <CommunityPageHeader
        title="Boost post"
        subtitle="Reach relevant members with a clearly labelled sponsored post."
      />

      {loadingPost ? (
        <YStack padding="$8" alignItems="center">
          <Spinner size="large" />
        </YStack>
      ) : !post ? (
        <Text color={ui.danger}>Post not found.</Text>
      ) : (
        <YStack gap="$4" paddingBottom="$6">
          <YStack gap="$2">
            <Text fontWeight="700" color={ui.text}>
              Preview
            </Text>
            <FeedPostCard post={post} sponsoredPreview />
          </YStack>

          <Panel title="Campaign">
            <Field label="Campaign name">
              <Input value={name} onChangeText={setName} maxLength={100} />
            </Field>
            <Text fontWeight="700" color={ui.text}>
              Goal
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {OBJECTIVES.map((item) => (
                <Choice
                  key={item.value}
                  active={objective === item.value}
                  label={item.label}
                  onPress={() => setObjective(item.value)}
                />
              ))}
            </XStack>
            <Text color={ui.textSecondary} fontSize={13}>
              {OBJECTIVES.find((item) => item.value === objective)?.detail}
            </Text>
          </Panel>

          <Panel title="Audience">
            <Text color={ui.textSecondary} fontSize={13}>
              Leave fields blank for a broad audience. Use commas between values.
            </Text>
            <Field label="Locations">
              <Input value={locations} onChangeText={setLocations} placeholder="Mumbai, Delhi" />
            </Field>
            <Field label="Industries">
              <Input value={industries} onChangeText={setIndustries} placeholder="Retail, Technology" />
            </Field>
            <Field label="Interests">
              <Input value={interests} onChangeText={setInterests} placeholder="Entrepreneurship, Fashion" />
            </Field>
          </Panel>

          <Panel title="Budget and duration">
            <XStack gap="$3" flexWrap="wrap">
              <Field label="Total budget (INR)" grow>
                <Input
                  value={totalBudget}
                  onChangeText={setTotalBudget}
                  keyboardType="numeric"
                />
              </Field>
              <Field label="Daily budget (INR)" grow>
                <Input value={dailyBudget} onChangeText={setDailyBudget} keyboardType="numeric" />
              </Field>
              <Field label="Days" grow>
                <Input value={durationDays} onChangeText={setDurationDays} keyboardType="numeric" />
              </Field>
            </XStack>
            <Text color={ui.textSecondary}>
              Estimated up to {estimate.toLocaleString()} impressions ·{' '}
              {formatCurrency(Number(totalBudget) || 0, 'INR')} prepaid
            </Text>
          </Panel>

          <Panel title="Action">
            <XStack gap="$2" flexWrap="wrap">
              {CTA_OPTIONS.map((item) => (
                <Choice
                  key={item.value}
                  active={callToAction === item.value}
                  label={item.label}
                  onPress={() => setCallToAction(item.value)}
                />
              ))}
            </XStack>
            {callToAction !== 'none' && callToAction !== 'visit_profile' ? (
              <Field label="HTTPS destination URL">
                <Input
                  value={destinationUrl}
                  onChangeText={setDestinationUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="https://example.com"
                />
              </Field>
            ) : null}
          </Panel>

          <YStack gap="$2">
            <Button tone="primary" disabled={submitting} onPress={submit}>
              {submitting
                ? canCheckout
                  ? 'Opening PayU…'
                  : 'Saving campaign…'
                : canCheckout
                  ? `Pay ${formatCurrency(Number(totalBudget) || 0, 'INR')}`
                  : 'Save campaign'}
            </Button>
            <Text fontSize={12} color={ui.textMuted} textAlign="center">
              {canCheckout
                ? 'Payment authorizes review. Delivery starts only after approval.'
                : 'This app does not process campaign billing. Delivery starts after prepaid budget is confirmed and the campaign is approved. You can pause, resume, and view results here.'}
            </Text>
          </YStack>
        </YStack>
      )}
    </CommunityShell>
  )
}

function splitList(value: string): string[] | undefined {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20)
  return items.length ? items : undefined
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  const ui = useAppUi()
  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius="$4"
      borderWidth={1}
      borderColor={ui.border}
      backgroundColor={ui.surface}
    >
      <Text fontSize={17} fontWeight="700" color={ui.text}>
        {title}
      </Text>
      {children}
    </YStack>
  )
}

function Field({
  label,
  children,
  grow,
}: {
  label: string
  children: ReactNode
  grow?: boolean
}) {
  const ui = useAppUi()
  return (
    <YStack gap="$1.5" flex={grow ? 1 : undefined} minWidth={grow ? 160 : undefined}>
      <Text fontSize={13} fontWeight="600" color={ui.textSecondary}>
        {label}
      </Text>
      {children}
    </YStack>
  )
}

function Choice({
  active,
  label,
  onPress,
}: {
  active: boolean
  label: string
  onPress: () => void
}) {
  const ui = useAppUi()
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius={999}
      borderWidth={1}
      borderColor={active ? ui.brand : ui.border}
      backgroundColor={active ? ui.badgeBrandBg : ui.surface}
      cursor="pointer"
      onPress={onPress}
    >
      <Text color={active ? ui.badgeBrandText : ui.textSecondary} fontWeight="600">
        {label}
      </Text>
    </XStack>
  )
}
