import { useCallback, useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'
import { useRouter } from 'one'

import {
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { formatOrderAmount, formatOrderDate } from '~/lib/orders/order.utils'
import {
  ensureReferralCode,
  getInviteShareUrl,
} from '~/lib/referral/invite'
import { useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'
import {
  WALLET_MIN_TOPUP,
  WALLET_TOPUP_PRESETS,
  beginPlatformWalletPayuTopup,
  fetchPlatformWalletStatus,
  fetchReferralRewards,
  ledgerLabel,
  type PlatformWalletStatus,
} from '~/lib/wallet/platform-wallet'
import { VENDOR_SHIPPING_UI_COPY } from '~/lib/vendor-shipping/vendor-shipping-ui.copy'
import { commerceRoutes } from '~/lib/routes'

type TabId = 'activity' | 'referrals'

export function VendorWalletScreen() {
  const ui = useAppUi()
  const router = useRouter()
  const { isDesktop, safeBottom } = useAppLayout()
  const toast = useAppToast()
  const { user } = useSupabase()
  const shop = useAppSelector((s) => s.shop.currentShop)
  const isLoadingMyShops = useAppSelector((s) => s.shop.isLoadingMyShops)
  const myShopsLoaded = useAppSelector((s) => s.shop.myShopsLoaded)

  const shopId = shop?.id ?? null

  const [refreshing, setRefreshing] = useState(false)
  const [status, setStatus] = useState<PlatformWalletStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [topupAmount, setTopupAmount] = useState(String(WALLET_TOPUP_PRESETS[2]))
  const [toppingUp, setToppingUp] = useState(false)
  const [tab, setTab] = useState<TabId>('activity')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [rewards, setRewards] = useState<
    Awaited<ReturnType<typeof fetchReferralRewards>>
  >([])

  const load = useCallback(async () => {
    if (!shopId) {
      setStatus(null)
      return
    }
    setLoading(true)
    try {
      const next = await fetchPlatformWalletStatus('shop', shopId)
      setStatus(next)
      if (!next) {
        toast.show('Could not load wallet', {
          tone: 'danger',
          message: 'Try refreshing in a moment.',
        })
      }
      if (user?.id) {
        const codeResult = await ensureReferralCode(user.id)
        setInviteCode(codeResult.code)
        setRewards(await fetchReferralRewards(20))
      }
    } finally {
      setLoading(false)
    }
  }, [shopId, toast, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await load()
      toast.show('Wallet refreshed', { tone: 'success' })
    } finally {
      setRefreshing(false)
    }
  }

  async function handleTopup() {
    if (!shopId) return
    const amount = Number(topupAmount)
    if (!(amount >= WALLET_MIN_TOPUP)) {
      toast.show('Minimum top-up', {
        tone: 'warning',
        message: `Enter at least ₹${WALLET_MIN_TOPUP}.`,
      })
      return
    }
    setToppingUp(true)
    try {
      const result = await beginPlatformWalletPayuTopup({
        ownerType: 'shop',
        ownerId: shopId,
        amount,
      })
      if (!result.ok) {
        toast.show('Top-up failed', { tone: 'danger', message: result.error })
      }
    } finally {
      setToppingUp(false)
    }
  }

  const referralEarnings = useMemo(
    () =>
      rewards
        .filter((r) => r.status === 'credited')
        .reduce((sum, r) => sum + r.amount, 0),
    [rewards],
  )

  if (!shop && (isLoadingMyShops || !myShopsLoaded)) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" minHeight={360}>
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!shop) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$3">
        <Icons.Store size={28} color={ui.textMuted} />
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          {VENDOR_SHIPPING_UI_COPY.noShopTitle}
        </Text>
        <Text fontSize={13} color={ui.textSecondary} textAlign="center">
          {VENDOR_SHIPPING_UI_COPY.noShopBody}
        </Text>
      </YStack>
    )
  }

  const lowBalance = Boolean(status?.lowBalance)
  const balance = status?.balance
  const currency = status?.currency ?? 'INR'
  const ledger = status?.ledger ?? []

  return (
    <YStack
      width="100%"
      maxWidth="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      <YStack gap="$1">
        <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text} letterSpacing={-0.5}>
          Wallet
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
          One prepaid balance for shipping labels, sponsored ads, and referral rewards. Top up with
          PayU anytime.
        </Text>
      </YStack>

      {lowBalance ? (
        <YStack
          gap="$2"
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.danger}
          backgroundColor={ui.roseSurface}
        >
          <Text fontSize={14} fontWeight="700" color={ui.text}>
            Wallet balance is low
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
            Add funds before buying more shipping labels or boosting posts.
          </Text>
        </YStack>
      ) : null}

      <YStack
        gap="$4"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
          <YStack gap="$1">
            <Text fontSize={12} color={ui.textMuted}>
              Available balance
            </Text>
            <Text fontSize={28} fontWeight="800" color={ui.text}>
              {loading && !status
                ? '…'
                : status
                  ? `${currency} ${Number(balance ?? 0).toFixed(2)}`
                  : '—'}
            </Text>
            {status?.updatedAt ? (
              <Text fontSize={12} color={ui.textMuted}>
                Updated {formatOrderDate(status.updatedAt, true)}
              </Text>
            ) : null}
          </YStack>
          <Button
            tone="outline"
            disabled={refreshing || loading}
            icon={<Icons.RefreshCw size={15} />}
            onPress={() => void handleRefresh()}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </XStack>

        <YStack gap="$3">
          <Text fontSize={13} fontWeight="700" color={ui.text}>
            Top up with PayU
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {WALLET_TOPUP_PRESETS.map((preset) => (
              <Button
                key={preset}
                size="$2"
                tone={Number(topupAmount) === preset ? 'primary' : 'outline'}
                onPress={() => setTopupAmount(String(preset))}
              >
                ₹{preset}
              </Button>
            ))}
          </XStack>
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Input
              value={topupAmount}
              onChangeText={setTopupAmount}
              keyboardType="numeric"
              width={140}
              placeholder="Amount"
            />
            <Button
              tone="primary"
              disabled={toppingUp}
              icon={<Icons.Wallet size={15} />}
              onPress={() => void handleTopup()}
            >
              {toppingUp ? 'Opening PayU…' : 'Top up'}
            </Button>
          </XStack>
          <Text fontSize={12} color={ui.textMuted}>
            Minimum ₹{WALLET_MIN_TOPUP}. Completes on the website via PayU.
          </Text>
        </YStack>
      </YStack>

      <XStack gap="$2">
        <Button
          size="$3"
          tone={tab === 'activity' ? 'primary' : 'outline'}
          onPress={() => setTab('activity')}
        >
          Activity
        </Button>
        <Button
          size="$3"
          tone={tab === 'referrals' ? 'primary' : 'outline'}
          onPress={() => setTab('referrals')}
        >
          Referrals
        </Button>
      </XStack>

      {tab === 'activity' ? (
        <YStack
          gap="$3"
          padding="$5"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          style={getShadowStyle('sm')}
        >
          <Text fontSize={14} fontWeight="800" color={ui.text}>
            Recent activity
          </Text>
          {loading && !ledger.length ? (
            <Spinner />
          ) : ledger.length === 0 ? (
            <Text fontSize={13} color={ui.textMuted}>
              No top-ups or spends yet.
            </Text>
          ) : (
            ledger.map((row) => (
              <XStack
                key={row.id}
                justifyContent="space-between"
                gap="$3"
                paddingVertical="$2"
                borderBottomWidth={1}
                borderBottomColor={ui.borderSubtle}
              >
                <YStack flex={1} minWidth={0} gap={2}>
                  <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
                    {ledgerLabel(row.entry_type, row.direction)}
                  </Text>
                  <Text fontSize={11} color={ui.textMuted}>
                    {formatOrderDate(row.created_at, true)}
                  </Text>
                </YStack>
                <Text
                  fontSize={13}
                  fontWeight="800"
                  color={row.direction === 'debit' ? ui.danger : ui.text}
                >
                  {row.direction === 'debit' ? '−' : '+'}
                  {formatOrderAmount(row.amount, row.currency || currency)}
                </Text>
              </XStack>
            ))
          )}
        </YStack>
      ) : (
        <YStack
          gap="$3"
          padding="$5"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          style={getShadowStyle('sm')}
        >
          <Text fontSize={14} fontWeight="800" color={ui.text}>
            Invite sellers & earn ₹200
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
            When a seller you invite completes PayU KYC and gets their first paid order, ₹200 is
            credited to your personal wallet. Buyers you invite earn ₹50 each on first purchase
            (you get ₹50 too).
          </Text>
          {inviteCode ? (
            <YStack gap="$2">
              <Text fontSize={12} color={ui.textMuted}>
                Your invite code
              </Text>
              <Text fontSize={20} fontWeight="800" color={ui.text} letterSpacing={1}>
                {inviteCode}
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  tone="primary"
                  size="$3"
                  icon={<Icons.Share2 size={15} />}
                  onPress={() => {
                    const url = getInviteShareUrl(inviteCode)
                    void Share.share({
                      message: `Join SHEconomy with my invite code ${inviteCode}: ${url}`,
                      url,
                    })
                  }}
                >
                  Share invite
                </Button>
                <Button
                  tone="outline"
                  size="$3"
                  onPress={() => router.push(commerceRoutes.invite(inviteCode) as never)}
                >
                  Open invite page
                </Button>
              </XStack>
            </YStack>
          ) : (
            <Text fontSize={13} color={ui.textMuted}>
              Sign in to generate your invite code.
            </Text>
          )}
          <Text fontSize={13} fontWeight="700" color={ui.text}>
            Referral earnings credited: {formatOrderAmount(referralEarnings, 'INR')}
          </Text>
          {rewards.length === 0 ? (
            <Text fontSize={13} color={ui.textMuted}>
              No referral rewards yet.
            </Text>
          ) : (
            rewards.map((row) => (
              <XStack key={row.id} justifyContent="space-between" gap="$3" paddingVertical="$2">
                <YStack flex={1} gap={2}>
                  <Text fontSize={13} fontWeight="700" color={ui.text}>
                    {row.program === 'seller_seller' ? 'Seller referral' : 'Buyer referral'}
                  </Text>
                  <Text fontSize={11} color={ui.textMuted}>
                    {row.status} · {formatOrderDate(row.created_at, true)}
                  </Text>
                </YStack>
                <Text fontSize={13} fontWeight="800" color={ui.text}>
                  {formatOrderAmount(row.amount, row.currency)}
                </Text>
              </XStack>
            ))
          )}
        </YStack>
      )}
    </YStack>
  )
}
