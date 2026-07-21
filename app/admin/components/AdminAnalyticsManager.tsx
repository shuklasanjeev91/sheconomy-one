import { useEffect, useState } from 'react'

import { Badge, Button, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { supabase } from '~/lib/supabase'
import { useAppUi } from '~/lib/theme/useAppUi'

type AnalyticsSnapshot = {
  orders30d: number
  revenue30d: number
  paymentsCompleted30d: number
  newUsers30d: number
  newShops30d: number
  activeListings: number
  openIssues: number
  reportsOpen: number
  topCategories: { label: string; count: number }[]
}

const EMPTY: AnalyticsSnapshot = {
  orders30d: 0,
  revenue30d: 0,
  paymentsCompleted30d: 0,
  newUsers30d: 0,
  newShops30d: 0,
  activeListings: 0,
  openIssues: 0,
  reportsOpen: 0,
  topCategories: [],
}

function formatMoney(value: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `₹${Math.round(value)}`
  }
}

export function AdminAnalyticsManager() {
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
      ordersRes,
      paymentsRes,
      usersRes,
      shopsRes,
      listingsRes,
      issuesRes,
      reportsRes,
      analyticsRes,
    ] = await Promise.all([
      supabase
        .from('orders')
        .select('id, total_amount, created_at')
        .gte('created_at', since)
        .limit(5000),
      supabase
        .from('order_payments')
        .select('id, amount, payment_status, created_at')
        .gte('created_at', since)
        .limit(5000),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase.from('shops').select('id', { count: 'exact', head: true }).gte('created_at', since),
      supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('order_issues')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'pending', 'in_progress']),
      supabase.from('content_reports').select('id', { count: 'exact', head: true }),
      supabase
        .from('sales_analytics')
        .select('product_category')
        .gte('ordered_at', since)
        .limit(2000),
    ])

    const firstError =
      ordersRes.error ||
      paymentsRes.error ||
      usersRes.error ||
      shopsRes.error ||
      listingsRes.error ||
      issuesRes.error ||
      reportsRes.error ||
      analyticsRes.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const orders = ordersRes.data ?? []
    const payments = paymentsRes.data ?? []
    const completed = payments.filter((p) => p.payment_status === 'completed')
    const categoryCounts = new Map<string, number>()
    for (const row of analyticsRes.data ?? []) {
      const label = row.product_category?.trim() || 'Uncategorized'
      categoryCounts.set(label, (categoryCounts.get(label) ?? 0) + 1)
    }
    const topCategories = [...categoryCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    setSnapshot({
      orders30d: orders.length,
      revenue30d: completed.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      paymentsCompleted30d: completed.length,
      newUsers30d: usersRes.count ?? 0,
      newShops30d: shopsRes.count ?? 0,
      activeListings: listingsRes.count ?? 0,
      openIssues: issuesRes.count ?? 0,
      reportsOpen: reportsRes.count ?? 0,
      topCategories,
    })
    setUpdatedAt(new Date().toISOString())
    setLoading(false)
  }

  const cards = [
    { label: 'Orders (30d)', value: String(snapshot.orders30d), icon: Icons.ShoppingCart },
    { label: 'Revenue (30d)', value: formatMoney(snapshot.revenue30d), icon: Icons.CreditCard },
    {
      label: 'Completed payments',
      value: String(snapshot.paymentsCompleted30d),
      icon: Icons.BadgeCheck,
    },
    { label: 'New users', value: String(snapshot.newUsers30d), icon: Icons.Users },
    { label: 'New shops', value: String(snapshot.newShops30d), icon: Icons.Store },
    { label: 'Active listings', value: String(snapshot.activeListings), icon: Icons.Package },
    { label: 'Open issues', value: String(snapshot.openIssues), icon: Icons.AlertCircle },
    { label: 'Content reports', value: String(snapshot.reportsOpen), icon: Icons.ShieldCheck },
  ]

  return (
    <YStack
      flex={1}
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={safeBottom + 24}
    >
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minWidth={200}>
          <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text}>
            Analytics
          </Text>
          <Text fontSize={14} color={ui.textSecondary}>
            Platform metrics for the last 30 days.
          </Text>
          {updatedAt ? (
            <Text fontSize={11} color={ui.textMuted}>
              Updated {new Date(updatedAt).toLocaleString()}
            </Text>
          ) : null}
        </YStack>
        <Button size="$3" onPress={() => void load()} disabled={loading}>
          {loading ? <Spinner size="small" /> : <Text>Refresh</Text>}
        </Button>
      </XStack>

      {error ? <Text color={ui.danger}>{error}</Text> : null}

      {loading && !updatedAt ? (
        <YStack alignItems="center" paddingVertical="$8">
          <Spinner size="large" />
        </YStack>
      ) : (
        <ScrollView flex={1}>
          <YStack gap="$4">
            <XStack flexWrap="wrap" gap="$3">
              {cards.map((card) => {
                const Icon = card.icon
                return (
                  <YStack
                    key={card.label}
                    flex={1}
                    minWidth={isDesktop ? 200 : 140}
                    padding="$4"
                    gap="$2"
                    borderRadius={radius.card}
                    borderWidth={1}
                    borderColor={ui.borderSubtle}
                    backgroundColor={ui.surface}
                    style={getShadowStyle('sm')}
                  >
                    <Icon size={18} color={ui.brand} />
                    <Text fontSize={22} fontWeight="800" color={ui.text}>
                      {card.value}
                    </Text>
                    <Text fontSize={12} color={ui.textMuted}>
                      {card.label}
                    </Text>
                  </YStack>
                )
              })}
            </XStack>

            <YStack
              gap="$3"
              padding="$4"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
              style={getShadowStyle('sm')}
            >
              <Text fontSize={16} fontWeight="700" color={ui.text}>
                Top categories (30d)
              </Text>
              {snapshot.topCategories.length === 0 ? (
                <Text color={ui.textMuted}>No sales analytics yet.</Text>
              ) : (
                snapshot.topCategories.map((row) => (
                  <XStack key={row.label} justifyContent="space-between" alignItems="center" gap="$2">
                    <Text fontSize={14} color={ui.text} flex={1} numberOfLines={1}>
                      {row.label}
                    </Text>
                    <Badge>{row.count}</Badge>
                  </XStack>
                ))
              )}
            </YStack>
          </YStack>
        </ScrollView>
      )}
    </YStack>
  )
}
