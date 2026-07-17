import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'one'
import type { Href } from 'one'

import { Badge, Button, Icons, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { supabase, type Tables } from '~/lib/supabase'

type ProfileRow = Tables<'profiles'>
type PresenceRow = Tables<'page_presence'>
type CartRow = Tables<'carts'>
type CartItemRow = Tables<'cart_items'>
type OrderRow = Tables<'orders'>
type PaymentRow = Tables<'order_payments'>
type ShopRow = Tables<'shops'>
type ListingRow = Tables<'listings'>
type IssueRow = Tables<'order_issues'>
type FulfillmentRow = Tables<'order_fulfillments'>

type DashboardSnapshot = {
  users: {
    total: number
    active: number
    online: number
    registeredToday: number
    vendors: number
  }
  shops: {
    total: number
    active: number
    verified: number
  }
  products: {
    total: number
    active: number
    draft: number
  }
  commerce: {
    orders: number
    openOrders: number
    revenue: number
    completedPayments: number
    recentOrders: OrderPreview[]
  }
  carts: {
    total: number
    active: number
    guest: number
    loggedIn: number
    value: number
    addEvents: number
    savedQuantity: number
    topItems: CartItemMetric[]
    recent: CartPreview[]
  }
  operations: {
    openIssues: number
    urgentIssues: number
    pendingFulfillments: number
    shippedFulfillments: number
  }
  traffic: {
    activeSessions: number
    loggedInSessions: number
    guestSessions: number
    topPages: PagePreview[]
    loggedInPages: PagePreview[]
    guestPages: PagePreview[]
    recentPresence: PresenceRow[]
  }
}

type OrderPreview = Pick<OrderRow, 'id' | 'order_number' | 'order_status' | 'total_amount' | 'created_at'>
type CartPreview = Pick<CartRow, 'id' | 'status' | 'total_amount' | 'user_id' | 'session_id' | 'last_activity_at' | 'cart_metadata'>

type CartItemMetric = {
  title: string
  quantity: number
  amount: number
}

type PagePreview = {
  key: string
  path: string
  sessions: number
  loggedIn: number
  guest: number
  lastSeen: string | null
}

const EMPTY_DASHBOARD: DashboardSnapshot = {
  users: {
    total: 0,
    active: 0,
    online: 0,
    registeredToday: 0,
    vendors: 0,
  },
  shops: {
    total: 0,
    active: 0,
    verified: 0,
  },
  products: {
    total: 0,
    active: 0,
    draft: 0,
  },
  commerce: {
    orders: 0,
    openOrders: 0,
    revenue: 0,
    completedPayments: 0,
    recentOrders: [],
  },
  carts: {
    total: 0,
    active: 0,
    guest: 0,
    loggedIn: 0,
    value: 0,
    addEvents: 0,
    savedQuantity: 0,
    topItems: [],
    recent: [],
  },
  operations: {
    openIssues: 0,
    urgentIssues: 0,
    pendingFulfillments: 0,
    shippedFulfillments: 0,
  },
  traffic: {
    activeSessions: 0,
    loggedInSessions: 0,
    guestSessions: 0,
    topPages: [],
    loggedInPages: [],
    guestPages: [],
    recentPresence: [],
  },
}

export default function AdminPage() {
  return <AdminDashboard />
}

function AdminDashboard() {
  const router = useRouter()
  const { isDesktop, safeBottom } = useAppLayout()
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    void loadDashboard()
  }, [])

  async function loadDashboard() {
    setError(null)
    setRefreshing(true)
    if (!lastUpdated) setLoading(true)

    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const activeSince = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

    const [
      profilesRes,
      shopsRes,
      listingsRes,
      ordersRes,
      paymentsRes,
      cartsRes,
      cartItemsRes,
      issuesRes,
      fulfillmentsRes,
      presenceRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, role, is_active, is_online, created_at, is_deleted')
        .limit(5000),
      supabase.from('shops').select('id, is_active, verified, created_at').limit(5000),
      supabase.from('listings').select('id, is_active, listing_status, created_at').limit(5000),
      supabase
        .from('orders')
        .select('id, order_number, order_status, total_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('order_payments')
        .select('id, payment_status, amount, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('carts')
        .select('id, status, total_amount, user_id, session_id, last_activity_at, cart_metadata')
        .order('last_activity_at', { ascending: false })
        .limit(1000),
      supabase
        .from('cart_items')
        .select('id, cart_id, title, quantity, total_price, unit_price, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('order_issues')
        .select('id, status, issue_priority, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('order_fulfillments')
        .select('id, fulfillment_status, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('page_presence')
        .select('*')
        .gte('last_seen', activeSince)
        .order('last_seen', { ascending: false })
        .limit(500),
    ])

    const firstError =
      profilesRes.error ??
      shopsRes.error ??
      listingsRes.error ??
      ordersRes.error ??
      paymentsRes.error ??
      cartsRes.error ??
      cartItemsRes.error ??
      issuesRes.error ??
      fulfillmentsRes.error ??
      presenceRes.error

    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const profiles = (profilesRes.data ?? []) as Pick<ProfileRow, 'id' | 'role' | 'is_active' | 'is_online' | 'created_at' | 'is_deleted'>[]
    const shops = (shopsRes.data ?? []) as Pick<ShopRow, 'id' | 'is_active' | 'verified' | 'created_at'>[]
    const listings = (listingsRes.data ?? []) as Pick<ListingRow, 'id' | 'is_active' | 'listing_status' | 'created_at'>[]
    const orders = (ordersRes.data ?? []) as OrderPreview[]
    const payments = (paymentsRes.data ?? []) as Pick<PaymentRow, 'id' | 'payment_status' | 'amount' | 'created_at'>[]
    const carts = (cartsRes.data ?? []) as CartPreview[]
    const cartItems = (cartItemsRes.data ?? []) as Pick<CartItemRow, 'id' | 'cart_id' | 'title' | 'quantity' | 'total_price' | 'unit_price' | 'created_at'>[]
    const issues = (issuesRes.data ?? []) as Pick<IssueRow, 'id' | 'status' | 'issue_priority' | 'created_at'>[]
    const fulfillments = (fulfillmentsRes.data ?? []) as Pick<FulfillmentRow, 'id' | 'fulfillment_status' | 'created_at'>[]
    const presence = (presenceRes.data ?? []) as PresenceRow[]

    setSnapshot({
      users: {
        total: profiles.length,
        active: profiles.filter((profile) => profile.is_active && !profile.is_deleted).length,
        online: profiles.filter((profile) => profile.is_online).length,
        registeredToday: profiles.filter((profile) => isAfter(profile.created_at, today)).length,
        vendors: profiles.filter((profile) => profile.role === 'V').length,
      },
      shops: {
        total: shops.length,
        active: shops.filter((shop) => shop.is_active).length,
        verified: shops.filter((shop) => shop.verified).length,
      },
      products: {
        total: listings.length,
        active: listings.filter((listing) => listing.is_active).length,
        draft: listings.filter((listing) => listing.listing_status === 'draft').length,
      },
      commerce: {
        orders: orders.length,
        openOrders: orders.filter((order) => !['delivered', 'completed', 'cancelled', 'refunded'].includes(order.order_status)).length,
        revenue: sum(payments.filter((payment) => payment.payment_status === 'completed').map((payment) => payment.amount)),
        completedPayments: payments.filter((payment) => payment.payment_status === 'completed').length,
        recentOrders: orders.slice(0, 6),
      },
      carts: {
        total: carts.length,
        active: carts.filter((cart) => cart.status === 'active').length,
        guest: carts.filter((cart) => !cart.user_id).length,
        loggedIn: carts.filter((cart) => Boolean(cart.user_id)).length,
        value: sum(carts.map((cart) => cart.total_amount)),
        addEvents: sum(carts.map((cart) => getCartAnalyticsNumber(cart.cart_metadata, 'add_count'))),
        savedQuantity: sum(cartItems.map((item) => item.quantity)),
        topItems: groupCartItems(cartItems),
        recent: carts.slice(0, 6),
      },
      operations: {
        openIssues: issues.filter((issue) => !['resolved', 'closed', 'cancelled'].includes(issue.status ?? 'open')).length,
        urgentIssues: issues.filter((issue) => ['high', 'urgent', 'critical'].includes(issue.issue_priority ?? '')).length,
        pendingFulfillments: fulfillments.filter((fulfillment) => ['pending', 'processing', 'ready_to_ship'].includes(fulfillment.fulfillment_status)).length,
        shippedFulfillments: fulfillments.filter((fulfillment) => ['shipped', 'out_for_delivery'].includes(fulfillment.fulfillment_status)).length,
      },
      traffic: {
        activeSessions: presence.length,
        loggedInSessions: presence.filter((row) => Boolean(row.user_id) && !row.is_guest).length,
        guestSessions: presence.filter((row) => !row.user_id || row.is_guest).length,
        topPages: groupPresence(presence),
        loggedInPages: groupPresence(presence.filter((row) => Boolean(row.user_id) && !row.is_guest)),
        guestPages: groupPresence(presence.filter((row) => !row.user_id || row.is_guest)),
        recentPresence: presence.slice(0, 12),
      },
    })
    setLastUpdated(new Date().toLocaleString())
    setLoading(false)
    setRefreshing(false)
  }

  const healthCards = useMemo(
    () => [
      {
        title: 'Users',
        value: snapshot.users.total,
        subtitle: `${snapshot.users.active} active, ${snapshot.users.online} online`,
        icon: Icons.Users,
        href: '/admin/users' as Href,
        tone: 'info' as const,
      },
      {
        title: 'Vendors & Shops',
        value: snapshot.shops.total,
        subtitle: `${snapshot.shops.active} active shops, ${snapshot.users.vendors} vendor profiles`,
        icon: Icons.Store,
        href: '/admin/shops' as Href,
        tone: 'success' as const,
      },
      {
        title: 'Products',
        value: snapshot.products.total,
        subtitle: `${snapshot.products.active} active, ${snapshot.products.draft} drafts`,
        icon: Icons.Package,
        href: '/admin/products' as Href,
        tone: 'brand' as const,
      },
      {
        title: 'Orders',
        value: snapshot.commerce.orders,
        subtitle: `${snapshot.commerce.openOrders} need attention`,
        icon: Icons.ShoppingCart,
        href: '/admin/orders' as Href,
        tone: 'warning' as const,
      },
      {
        title: 'Revenue',
        value: formatMoney(snapshot.commerce.revenue),
        subtitle: `${snapshot.commerce.completedPayments} completed payments`,
        icon: Icons.CreditCard,
        href: '/admin/payments' as Href,
        tone: 'success' as const,
      },
      {
        title: 'Live Visitors',
        value: snapshot.traffic.activeSessions,
        subtitle: `${snapshot.traffic.loggedInSessions} logged in, ${snapshot.traffic.guestSessions} guests`,
        icon: Icons.Activity,
        href: '/admin' as Href,
        tone: 'info' as const,
      },
    ],
    [snapshot],
  )

  if (loading) {
    return (
      <YStack minHeight={420} alignItems="center" justifyContent="center" gap="$3">
        <Spinner size="large" />
        <Text color="$color10">Loading admin dashboard...</Text>
      </YStack>
    )
  }

  return (
    <YStack width="100%" gap="$5" paddingHorizontal={isDesktop ? '$6' : '$4'} paddingTop="$5" paddingBottom={safeBottom + 28}>
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontSize={28} fontWeight="800" color="$color12">Admin Dashboard</Text>
          <Text color="$color10">Platform command center for users, vendors, products, orders, carts, traffic, and operational alerts.</Text>
          {lastUpdated ? <Text color="$color10" fontSize={12}>Last updated {lastUpdated}</Text> : null}
        </YStack>
        <XStack gap="$2" flexWrap="wrap">
          <Button icon={Icons.RefreshCw} onPress={() => void loadDashboard()} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </XStack>
      </XStack>

      {error ? (
        <YStack padding="$3" borderRadius={radius.card} backgroundColor="$red3" borderWidth={1} borderColor="$red7">
          <Text color="$red11" fontWeight="700">{error}</Text>
        </YStack>
      ) : null}

      <XStack gap="$3" flexWrap="wrap">
        {healthCards.map((card) => (
          <DashboardCard key={card.title} {...card} onPress={() => router.push(card.href)} />
        ))}
      </XStack>

      <XStack gap="$4" flexWrap="wrap" alignItems="stretch">
        <DashboardPanel title="What Needs Attention" icon={Icons.ShieldCheck}>
          <AlertRow label="Open order issues" value={snapshot.operations.openIssues} href="/admin/orders" onNavigate={(href) => router.push(href)} danger={snapshot.operations.openIssues > 0} />
          <AlertRow label="High priority issues" value={snapshot.operations.urgentIssues} href="/admin/orders" onNavigate={(href) => router.push(href)} danger={snapshot.operations.urgentIssues > 0} />
          <AlertRow label="Pending fulfillments" value={snapshot.operations.pendingFulfillments} href="/admin/orders" onNavigate={(href) => router.push(href)} danger={snapshot.operations.pendingFulfillments > 0} />
          <AlertRow label="Active carts not checked out" value={snapshot.carts.active} href="/admin/cart" onNavigate={(href) => router.push(href)} danger={snapshot.carts.active > 0} />
        </DashboardPanel>

        <DashboardPanel title="Growth Snapshot" icon={Icons.TrendingUp}>
          <ProgressRow label="New users today" value={snapshot.users.registeredToday} total={Math.max(snapshot.users.total, 1)} />
          <ProgressRow label="Active users" value={snapshot.users.active} total={Math.max(snapshot.users.total, 1)} />
          <ProgressRow label="Verified shops" value={snapshot.shops.verified} total={Math.max(snapshot.shops.total, 1)} />
          <ProgressRow label="Active listings" value={snapshot.products.active} total={Math.max(snapshot.products.total, 1)} />
        </DashboardPanel>

        <DashboardPanel title="Cart Funnel" icon={Icons.ShoppingCart}>
          <ProgressRow label="Logged-in carts" value={snapshot.carts.loggedIn} total={Math.max(snapshot.carts.total, 1)} />
          <ProgressRow label="Guest carts" value={snapshot.carts.guest} total={Math.max(snapshot.carts.total, 1)} />
          <ProgressRow label="Active carts" value={snapshot.carts.active} total={Math.max(snapshot.carts.total, 1)} />
          <ProgressRow label="Saved cart quantity" value={snapshot.carts.savedQuantity} total={Math.max(snapshot.carts.savedQuantity, 1)} />
          <XStack justifyContent="space-between" gap="$3" paddingTop="$1">
            <Text color="$color10">Add-to-cart events</Text>
            <Text color="$color12" fontWeight="800">{snapshot.carts.addEvents}</Text>
          </XStack>
          <XStack justifyContent="space-between" gap="$3">
            <Text color="$color10">Saved cart value</Text>
            <Text color="$color12" fontWeight="800">{formatMoney(snapshot.carts.value)}</Text>
          </XStack>
        </DashboardPanel>
      </XStack>

      <XStack gap="$4" flexWrap="wrap" alignItems="stretch">
        <PageActivityPanel title="Logged-In Page Activity" rows={snapshot.traffic.loggedInPages} empty="No logged-in visitor presence in the last 5 minutes." />
        <PageActivityPanel title="Guest Page Activity" rows={snapshot.traffic.guestPages} empty="No guest visitor presence in the last 5 minutes." />
      </XStack>

      <XStack gap="$4" flexWrap="wrap" alignItems="stretch">
        <DashboardPanel title="Recent Orders" icon={Icons.ShoppingCart} action={{ label: 'Open Orders', href: '/admin/orders' as Href }} onNavigate={(href) => router.push(href)}>
          {snapshot.commerce.recentOrders.length ? snapshot.commerce.recentOrders.map((order) => (
            <XStack key={order.id} gap="$3" alignItems="center" justifyContent="space-between" paddingVertical="$2.5" borderBottomWidth={1} borderBottomColor="$borderColor">
              <YStack flex={1} minWidth={0}>
                <Text fontWeight="800" color="$color12" numberOfLines={1}>{order.order_number}</Text>
                <Text color="$color10" fontSize={12}>{formatDate(order.created_at)}</Text>
              </YStack>
              <YStack alignItems="flex-end" gap="$1">
                <Badge tone={statusTone(order.order_status)} size="sm">{formatLabel(order.order_status)}</Badge>
                <Text color="$color12" fontWeight="800">{formatMoney(order.total_amount)}</Text>
              </YStack>
            </XStack>
          )) : <Text color="$color10">No orders found.</Text>}
        </DashboardPanel>

        <DashboardPanel title="Recent Carts" icon={Icons.ShoppingCart} action={{ label: 'Open Cart', href: '/admin/cart' as Href }} onNavigate={(href) => router.push(href)}>
          {snapshot.carts.recent.length ? snapshot.carts.recent.map((cart) => (
            <XStack key={cart.id} gap="$3" alignItems="center" justifyContent="space-between" paddingVertical="$2.5" borderBottomWidth={1} borderBottomColor="$borderColor">
              <YStack flex={1} minWidth={0}>
                <Text fontWeight="800" color="$color12" numberOfLines={1}>{cart.user_id ? 'Logged-in cart' : 'Guest cart'}</Text>
                <Text color="$color10" fontSize={12}>{formatDate(cart.last_activity_at)} • {cart.session_id ?? cart.user_id ?? cart.id}</Text>
              </YStack>
              <YStack alignItems="flex-end" gap="$1">
                <Badge tone={cart.user_id ? 'success' : 'warning'} size="sm">{formatLabel(cart.status)}</Badge>
                <Text color="$color12" fontWeight="800">{formatMoney(cart.total_amount)}</Text>
              </YStack>
            </XStack>
          )) : <Text color="$color10">No carts found.</Text>}
        </DashboardPanel>

        <DashboardPanel title="Top Saved Cart Products" icon={Icons.Package} action={{ label: 'Open Products', href: '/admin/products' as Href }} onNavigate={(href) => router.push(href)}>
          {snapshot.carts.topItems.length ? snapshot.carts.topItems.map((item) => (
            <XStack key={item.title} justifyContent="space-between" gap="$3" paddingVertical="$2" borderBottomWidth={1} borderBottomColor="$borderColor">
              <YStack flex={1} minWidth={0}>
                <Text fontWeight="800" color="$color12" numberOfLines={1}>{item.title}</Text>
                <Text color="$color10" fontSize={12}>Saved quantity {item.quantity}</Text>
              </YStack>
              <Text color="$color12" fontWeight="800">{formatMoney(item.amount)}</Text>
            </XStack>
          )) : <Text color="$color10">No saved cart products found.</Text>}
        </DashboardPanel>

        <DashboardPanel title="Live Pages" icon={Icons.Eye}>
          <ScrollView maxHeight={320}>
            <YStack gap="$2">
              {snapshot.traffic.topPages.length ? snapshot.traffic.topPages.map((page) => (
                <YStack key={page.key} padding="$2.5" borderRadius={radius.chip} backgroundColor="$color2" gap="$1">
                  <XStack justifyContent="space-between" gap="$3">
                    <Text flex={1} fontWeight="800" color="$color12" numberOfLines={1}>{page.path}</Text>
                    <Badge tone="info" size="sm">{page.sessions} sessions</Badge>
                  </XStack>
                  <Text color="$color10" fontSize={12}>{page.loggedIn} logged in • {page.guest} guest • last {formatDate(page.lastSeen)}</Text>
                </YStack>
              )) : <Text color="$color10">No live page presence in the last 5 minutes.</Text>}
            </YStack>
          </ScrollView>
        </DashboardPanel>

        <DashboardPanel title="Recent Live Presence" icon={Icons.Activity}>
          <ScrollView maxHeight={320}>
            <YStack gap="$2">
              {snapshot.traffic.recentPresence.length ? snapshot.traffic.recentPresence.map((row) => (
                <YStack key={row.id} padding="$2.5" borderRadius={radius.chip} backgroundColor="$color2" gap="$1">
                  <XStack justifyContent="space-between" gap="$2">
                    <Text flex={1} fontWeight="800" color="$color12" numberOfLines={1}>{row.path || row.page}</Text>
                    <Badge tone={row.user_id && !row.is_guest ? 'success' : 'warning'} size="sm">
                      {row.user_id && !row.is_guest ? 'Logged in' : 'Guest'}
                    </Badge>
                  </XStack>
                  <Text color="$color10" fontSize={12}>{formatDate(row.last_seen)} • {row.session_id ?? row.device_id ?? 'No session'}</Text>
                </YStack>
              )) : <Text color="$color10">No recent live presence found.</Text>}
            </YStack>
          </ScrollView>
        </DashboardPanel>
      </XStack>

      <DashboardPanel title="Quick Admin Actions" icon={Icons.LayoutDashboard}>
        <XStack gap="$2" flexWrap="wrap">
          {[
            { label: 'Manage Users', href: '/admin/users' as Href, icon: Icons.Users },
            { label: 'Review Shops', href: '/admin/shops' as Href, icon: Icons.Store },
            { label: 'Products', href: '/admin/products' as Href, icon: Icons.Package },
            { label: 'Orders', href: '/admin/orders' as Href, icon: Icons.ShoppingCart },
            { label: 'Payments', href: '/admin/payments' as Href, icon: Icons.CreditCard },
            { label: 'Categories', href: '/admin/categories' as Href, icon: Icons.Package },
            { label: 'CMS', href: '/admin/cms' as Href, icon: Icons.Settings },
            { label: 'Blog', href: '/admin/blog' as Href, icon: Icons.FileText },
          ].map((action) => (
            <Button key={action.label} tone="outline" icon={action.icon} onPress={() => router.push(action.href)}>
              {action.label}
            </Button>
          ))}
        </XStack>
      </DashboardPanel>
    </YStack>
  )
}

function DashboardCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  onPress,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: (typeof Icons)[keyof typeof Icons]
  href: Href
  tone: 'success' | 'warning' | 'brand' | 'info'
  onPress: () => void
}) {
  return (
    <YStack
      flex={1}
      minWidth={230}
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$background"
      cursor="pointer"
      hoverStyle={{ borderColor: '$color8', y: -1 }}
      pressStyle={{ opacity: 0.88 }}
      onPress={onPress}
      style={getShadowStyle('sm')}
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <YStack width={42} height={42} borderRadius={radius.card} alignItems="center" justifyContent="center" backgroundColor="$color2">
          <Icon size={20} color="$color10" />
        </YStack>
        <Badge tone={tone}>Open</Badge>
      </XStack>
      <YStack gap="$1">
        <Text fontSize={26} fontWeight="800" color="$color12">{value}</Text>
        <Text fontWeight="800" color="$color12">{title}</Text>
        <Text color="$color10" fontSize={12}>{subtitle}</Text>
      </YStack>
    </YStack>
  )
}

function DashboardPanel({
  title,
  icon: Icon,
  action,
  children,
  onNavigate,
}: {
  title: string
  icon: (typeof Icons)[keyof typeof Icons]
  action?: { label: string; href: Href }
  children: ReactNode
  onNavigate?: (href: Href) => void
}) {
  return (
    <YStack flex={1} minWidth={320} gap="$3" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <XStack alignItems="center" gap="$2">
          <YStack width={34} height={34} borderRadius={radius.chip} alignItems="center" justifyContent="center" backgroundColor="$color2">
            <Icon size={17} color="$color10" />
          </YStack>
          <Text fontWeight="800" color="$color12">{title}</Text>
        </XStack>
        {action && onNavigate ? (
          <Button size="$2.5" tone="ghost" iconAfter={Icons.ArrowRight} onPress={() => onNavigate(action.href)}>
            {action.label}
          </Button>
        ) : null}
      </XStack>
      <YStack gap="$2">{children}</YStack>
    </YStack>
  )
}

function PageActivityPanel({ title, rows, empty }: { title: string; rows: PagePreview[]; empty: string }) {
  return (
    <YStack flex={1} minWidth={330} gap="$3" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack alignItems="center" gap="$2">
        <YStack width={34} height={34} borderRadius={radius.chip} alignItems="center" justifyContent="center" backgroundColor="$color2">
          <Icons.Eye size={17} color="$color10" />
        </YStack>
        <Text fontWeight="800" color="$color12">{title}</Text>
      </XStack>
      {rows.length ? rows.map((row) => (
        <YStack key={row.key} gap="$1" paddingVertical="$2.5" borderBottomWidth={1} borderBottomColor="$borderColor">
          <XStack justifyContent="space-between" gap="$3" alignItems="center">
            <YStack flex={1} minWidth={0}>
              <Text fontWeight="800" color="$color12" numberOfLines={1}>{row.path}</Text>
              <Text color="$color10" fontSize={12}>{row.loggedIn} logged in • {row.guest} guest • last {formatDate(row.lastSeen)}</Text>
            </YStack>
            <Badge tone="info">{row.sessions} sessions</Badge>
          </XStack>
        </YStack>
      )) : <Text color="$color10">{empty}</Text>}
    </YStack>
  )
}

function AlertRow({
  label,
  value,
  href,
  danger,
  onNavigate,
}: {
  label: string
  value: number
  href: Href
  danger: boolean
  onNavigate: (href: Href) => void
}) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3" padding="$2.5" borderRadius={radius.chip} backgroundColor="$color2">
      <YStack flex={1}>
        <Text color="$color12" fontWeight="700">{label}</Text>
        <Text color="$color10" fontSize={12}>{danger ? 'Needs admin review' : 'Looks clear'}</Text>
      </YStack>
      <Badge tone={danger ? 'danger' : 'success'}>{value}</Badge>
      <Button size="$2.5" tone="ghost" onPress={() => onNavigate(href)}>Open</Button>
    </XStack>
  )
}

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <YStack gap="$1.5">
      <XStack justifyContent="space-between" gap="$3">
        <Text color="$color11" fontWeight="600">{label}</Text>
        <Text color="$color12" fontWeight="800">{value} ({pct}%)</Text>
      </XStack>
      <YStack height={6} borderRadius={999} backgroundColor="$color3" overflow="hidden">
        <YStack height={6} width={`${Math.min(100, pct)}%`} backgroundColor="$color9" />
      </YStack>
    </YStack>
  )
}

function groupPresence(rows: PresenceRow[]): PagePreview[] {
  const grouped = new Map<string, PagePreview>()
  for (const row of rows) {
    const key = row.path || row.page || 'Unknown page'
    const current = grouped.get(key) ?? {
      key,
      path: row.path || row.page || 'Unknown page',
      sessions: 0,
      loggedIn: 0,
      guest: 0,
      lastSeen: row.last_seen,
    }
    current.sessions += 1
    if (row.user_id && !row.is_guest) current.loggedIn += 1
    else current.guest += 1
    if (row.last_seen && (!current.lastSeen || new Date(row.last_seen) > new Date(current.lastSeen))) {
      current.lastSeen = row.last_seen
    }
    grouped.set(key, current)
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8)
}

function groupCartItems(rows: Pick<CartItemRow, 'title' | 'quantity' | 'total_price' | 'unit_price'>[]): CartItemMetric[] {
  const grouped = new Map<string, CartItemMetric>()
  for (const row of rows) {
    const title = row.title || 'Untitled item'
    const current = grouped.get(title) ?? { title, quantity: 0, amount: 0 }
    current.quantity += row.quantity ?? 0
    current.amount += row.total_price ?? (row.unit_price ?? 0) * (row.quantity ?? 0)
    grouped.set(title, current)
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)
}

function getCartAnalyticsNumber(metadata: unknown, key: 'add_count' | 'quantity_added') {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 0
  const analytics = (metadata as Record<string, unknown>).analytics
  if (!analytics || typeof analytics !== 'object' || Array.isArray(analytics)) return 0
  const value = (analytics as Record<string, unknown>)[key]
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function statusTone(status: string) {
  if (['delivered', 'completed'].includes(status)) return 'success' as const
  if (['cancelled', 'refunded', 'returned', 'failed_delivery', 'payment_failed', 'disputed'].includes(status)) return 'danger' as const
  if (['processing', 'confirmed', 'pending', 'awaiting_payment', 'on_hold'].includes(status)) return 'warning' as const
  return 'info' as const
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + Number(value ?? 0), 0)
}

function isAfter(value: string | null, date: Date) {
  return value ? new Date(value).getTime() >= date.getTime() : false
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value ?? 0))
}

function formatDate(value: string | null) {
  if (!value) return 'not available'
  return new Date(value).toLocaleString()
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
