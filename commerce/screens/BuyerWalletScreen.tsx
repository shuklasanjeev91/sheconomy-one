import { useCallback, useEffect, useMemo, useState } from 'react'
import { Share } from 'react-native'

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

type TabId = 'activity' | 'referrals'

export function BuyerWalletScreen() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { user, isLoading: authLoading } = useSupabase()
  const { isDesktop, safeBottom } = useAppLayout()

  const [status, setStatus] = useState<PlatformWalletStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [topupAmount, setTopupAmount] = useState(String(WALLET_TOPUP_PRESETS[1]))
  const [toppingUp, setToppingUp] = useState(false)
  const [tab, setTab] = useState<TabId>('activity')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [rewards, setRewards] = useState<
    Awaited<ReturnType<typeof fetchReferralRewards>>
  >([])

  const load = useCallback(async () => {
    if (!user?.id) {
      setStatus(null)
      return
    }
    setLoading(true)
    try {
      const next = await fetchPlatformWalletStatus('user', user.id)
      setStatus(next)
      const codeResult = await ensureReferralCode(user.id)
      setInviteCode(codeResult.code)
      setRewards(await fetchReferralRewards(20))
    } finally {
      setLoading(false)
    }
  }, [user?.id])

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
    if (!user?.id) return
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
        ownerType: 'user',
        ownerId: user.id,
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

  if (authLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" minHeight={360}>
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!user) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$6" gap="$3">
        <Icons.Wallet size={28} color={ui.textMuted} />
        <Text fontSize={16} fontWeight="700" color={ui.text}>
          Sign in to view your wallet
        </Text>
      </YStack>
    )
  }

  const currency = status?.currency ?? 'INR'
  const ledger = status?.ledger ?? []

  return (
    <YStack
      width="100%"
      maxWidth={720}
      alignSelf="center"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={(isDesktop ? 32 : 24) + safeBottom}
    >
      <YStack gap="$1">
        <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text}>
          Wallet
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
          Prepaid INR for shopping checkout and referral rewards. Top up with PayU on the website.
        </Text>
      </YStack>

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
                  ? `${currency} ${Number(status.balance).toFixed(2)}`
                  : '—'}
            </Text>
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
              No wallet activity yet.
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
                <YStack flex={1} gap={2}>
                  <Text fontSize={13} fontWeight="700" color={ui.text}>
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
            Invite friends · ₹50 each
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
            When someone shops with your invite and completes their first paid order, you both get
            ₹50 wallet credit.
          </Text>
          {inviteCode ? (
            <YStack gap="$2">
              <Text fontSize={20} fontWeight="800" color={ui.text} letterSpacing={1}>
                {inviteCode}
              </Text>
              <Button
                tone="primary"
                icon={<Icons.Share2 size={15} />}
                onPress={() => {
                  const url = getInviteShareUrl(inviteCode)
                  void Share.share({
                    message: `Join SHEconomy with my invite ${inviteCode} and we both get ₹50: ${url}`,
                    url,
                  })
                }}
              >
                Share invite
              </Button>
            </YStack>
          ) : null}
          <Text fontSize={13} fontWeight="700" color={ui.text}>
            Referral credits: {formatOrderAmount(referralEarnings, 'INR')}
          </Text>
          {rewards.map((row) => (
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
          ))}
        </YStack>
      )}
    </YStack>
  )
}
