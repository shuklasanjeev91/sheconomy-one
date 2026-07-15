import type { Href } from 'one'

import { Icons } from '~/components/ui'
import {
  type AccessTier,
  type AppFeature,
  canManageShops,
  resolveFeatureNavHref,
} from '~/lib/auth/access'
import {
  chatRoutes,
  classRoutes,
  coWorkRoutes,
  commerceRoutes,
  communityRoutes,
  routes,
  vendorRoutes,
} from '~/lib/routes'

export type AccountMenuItem = {
  id: string
  icon: typeof Icons.User
  label: string
  description?: string
  href: Href
  /** Optional non-navigation action (e.g. open AI assistant). */
  action?: 'open-ai'
  tone?: 'default' | 'danger'
  badge?: number
}

export type AccountMenuSection = {
  id: string
  title: string
  subtitle?: string
  items: AccountMenuItem[]
}

export type AccountQuickAction = {
  id: string
  icon: typeof Icons.User
  label: string
  href: Href
  badge?: number
}

type AccountMenuOptions = {
  tier: AccessTier
  hasShops: boolean
  primaryShopId?: string | null
  cartCount?: number
  wishlistCount?: number
}

function item(
  tier: AccessTier,
  id: string,
  icon: typeof Icons.User,
  label: string,
  href: Href | string,
  feature?: AppFeature,
  extra?: Partial<AccountMenuItem>,
): AccountMenuItem {
  const path = typeof href === 'string' ? href : String(href)
  return {
    id,
    icon,
    label,
    href: feature ? resolveFeatureNavHref(tier, path, feature) : (href as Href),
    ...extra,
  }
}

function badge(count?: number) {
  return count && count > 0 ? { badge: count } : {}
}

/** Pinned shopping shortcuts — items not repeated in sections below. */
export function getAccountQuickActions({
  tier,
  cartCount,
  wishlistCount,
}: Pick<AccountMenuOptions, 'tier' | 'cartCount' | 'wishlistCount'>): AccountQuickAction[] {
  return [
    {
      id: 'orders',
      icon: Icons.Package,
      label: 'Orders',
      href: item(tier, 'orders', Icons.Package, '', commerceRoutes.orders, 'commerce').href,
    },
    {
      id: 'cart',
      icon: Icons.ShoppingBag,
      label: 'Cart',
      href: item(tier, 'cart', Icons.ShoppingBag, '', commerceRoutes.cart, 'commerce').href,
      ...badge(cartCount),
    },
    {
      id: 'wishlist',
      icon: Icons.Heart,
      label: 'Wishlist',
      href: item(tier, 'wishlist', Icons.Heart, '', commerceRoutes.wishlist, 'commerce').href,
      ...badge(wishlistCount),
    },
  ]
}

/** Account drawer sections — every main app tab hub from the You menu. */
export function getAccountMenuSections({
  tier,
  hasShops,
}: Pick<AccountMenuOptions, 'tier' | 'hasShops' | 'primaryShopId'>): AccountMenuSection[] {
  const sections: AccountMenuSection[] = []

  sections.push({
    id: 'account',
    title: 'Your account',
    subtitle: 'Preferences and security',
    items: [
      item(tier, 'settings', Icons.Settings, 'Settings & privacy', routes.settings, 'account', {
        description: 'Shared across every tab — security, alerts, and appearance',
      }),
      item(tier, 'profile', Icons.User, 'Your profile', routes.profile, 'account', {
        description: 'Photo, headline, and career preferences',
      }),
      item(tier, 'notifications', Icons.Bell, 'Notifications', routes.notifications, 'account', {
        description: 'Alerts from marketplace, community, and chat',
      }),
      item(tier, 'help', Icons.HelpCircle, 'Help & Support', routes.help, 'account', {
        description: 'FAQs and contact for every tab — opens with your current product when possible',
      }),
      item(tier, 'ai-assist', Icons.Sparkles, 'Ask SHEconomy AI', routes.help, 'account', {
        description: 'Contextual help for Marketplace, Community, Chat, Class, Co-Work, and Shop',
        action: 'open-ai',
      }),
    ],
  })

  sections.push({
    id: 'marketplace',
    title: 'Marketplace',
    subtitle: 'Shop and discover',
    items: [
      item(tier, 'marketplace', Icons.Home, 'Marketplace home', commerceRoutes.home, 'commerce', {
        description: 'Featured products and recommendations',
      }),
      item(tier, 'shops', Icons.Store, 'Browse shops', commerceRoutes.shops, 'commerce', {
        description: 'Independent storefronts',
      }),
      item(tier, 'orders', Icons.Package, 'Order history', commerceRoutes.orders, 'commerce', {
        description: 'Track purchases and deliveries',
      }),
      item(tier, 'wishlist', Icons.Heart, 'Saved items', commerceRoutes.wishlist, 'commerce', {
        description: 'Listings you saved for later',
      }),
    ],
  })

  sections.push({
    id: 'shopping',
    title: 'Checkout',
    subtitle: 'Payment and delivery',
    items: [
      item(
        tier,
        'payments',
        Icons.CreditCard,
        'Payment methods',
        commerceRoutes.paymentMethods,
        'commerce',
        { description: 'Cards and wallets for checkout' },
      ),
      item(
        tier,
        'addresses',
        Icons.MapPin,
        'Delivery addresses',
        commerceRoutes.addresses,
        'commerce',
        { description: 'Shipping destinations for orders' },
      ),
    ],
  })

  if (canManageShops(tier)) {
    const shopManagerHref = hasShops
      ? vendorRoutes.myShop
      : (`${commerceRoutes.myShops}?create=1` as Href)

    sections.push({
      id: 'shop-manager',
      title: 'Shop manager',
      subtitle: 'Selling tools',
      items: [
        item(
          tier,
          'shop-manager',
          hasShops ? Icons.Store : Icons.PlusCircle,
          hasShops ? 'Manage your shop' : 'Start your shop',
          shopManagerHref,
          'commerce',
          {
            description: hasShops
              ? 'Listings, orders, and storefront settings'
              : 'Open a shop and start selling',
          },
        ),
      ],
    })
  }

  sections.push({
    id: 'social',
    title: 'Community',
    subtitle: 'Feed, network, and pages',
    items: [
      item(tier, 'feed', Icons.Home, 'News feed', communityRoutes.home, 'community', {
        description: 'Posts and updates from your network',
      }),
      item(tier, 'network', Icons.Users, 'Friends & network', communityRoutes.network, 'community', {
        description: 'Connections, followers, and requests',
      }),
      item(
        tier,
        'create-post',
        Icons.SquarePen,
        'Create post',
        communityRoutes.createPost,
        'community',
        { description: 'Share photos, updates, and stories' },
      ),
      item(tier, 'groups', Icons.UsersRound, 'Groups', communityRoutes.groups, 'community', {
        description: 'Communities you follow or manage',
      }),
      item(tier, 'events', Icons.CalendarDays, 'Events', communityRoutes.events, 'community', {
        description: 'Meetups and community gatherings',
      }),
      item(tier, 'pages', Icons.Building2, 'Pages', communityRoutes.companies, 'community', {
        description: 'Business and creator pages',
      }),
      item(tier, 'jobs', Icons.Briefcase, 'Jobs', communityRoutes.jobs, 'community', {
        description: 'Opportunities from the network',
      }),
      item(tier, 'stories', Icons.Film, 'Stories', communityRoutes.stories, 'community', {
        description: 'Short updates from people you follow',
      }),
    ],
  })

  sections.push({
    id: 'messaging',
    title: 'Chat',
    subtitle: 'Direct conversations',
    items: [
      item(tier, 'inbox', Icons.MessageCircle, 'Inbox', chatRoutes.home, 'chat', {
        description: 'Chats with buyers, sellers, and friends',
      }),
    ],
  })

  sections.push({
    id: 'classes',
    title: 'Classes',
    subtitle: 'Learning programs',
    items: [
      item(tier, 'video', Icons.Play, 'Video classes', classRoutes.video, 'class', {
        description: 'Watch programs and lessons',
      }),
      item(tier, 'audio', Icons.Radio, 'Audio classes', classRoutes.audio, 'class', {
        description: 'Listen on the go',
      }),
    ],
  })

  sections.push({
    id: 'co-work',
    title: 'Co-Work',
    subtitle: 'Meetings and collaboration',
    items: [
      item(tier, 'cowork-home', Icons.Video, 'Meeting home', coWorkRoutes.home, 'co-work', {
        description: 'Start or join a workspace session',
      }),
      item(tier, 'schedule', Icons.Calendar, 'Schedule', coWorkRoutes.schedule, 'co-work', {
        description: 'Upcoming sessions on your calendar',
      }),
      item(tier, 'meetings', Icons.Monitor, 'Your meetings', coWorkRoutes.meetings, 'co-work', {
        description: 'Past and active meeting rooms',
      }),
      item(tier, 'join', Icons.Hash, 'Join with code', coWorkRoutes.join, 'co-work', {
        description: 'Enter a meeting code',
      }),
    ],
  })

  return sections
}

/** Guest drawer — browse as a shopper, sign in for the full account hub. */
export function getGuestAccountMenuSections(): AccountMenuSection[] {
  return [
    {
      id: 'shopping',
      title: 'Shopping',
      subtitle: 'No account needed',
      items: [
        {
          id: 'marketplace',
          icon: Icons.Home,
          label: 'Browse marketplace',
          description: 'Discover shops and handmade finds',
          href: commerceRoutes.home,
        },
        {
          id: 'shops',
          icon: Icons.Store,
          label: 'Explore shops',
          description: 'Independent storefronts',
          href: commerceRoutes.shops,
        },
        {
          id: 'cart',
          icon: Icons.ShoppingBag,
          label: 'Cart',
          description: 'Items you added while browsing',
          href: commerceRoutes.cart,
        },
      ],
    },
    {
      id: 'sign-in',
      title: 'Your account',
      subtitle: 'Sign in to unlock',
      items: [
        {
          id: 'orders',
          icon: Icons.Package,
          label: 'Your orders',
          description: 'Track purchases and deliveries',
          href: commerceRoutes.orders,
        },
        {
          id: 'wishlist',
          icon: Icons.Heart,
          label: 'Wishlist',
          description: 'Saved listings and favorites',
          href: commerceRoutes.wishlist,
        },
        {
          id: 'payments',
          icon: Icons.CreditCard,
          label: 'Payment methods',
          description: 'Save cards for faster checkout',
          href: commerceRoutes.paymentMethods,
        },
        {
          id: 'shop',
          icon: Icons.PlusCircle,
          label: 'Open a shop',
          description: 'Seller tools and storefront setup',
          href: commerceRoutes.myShops,
        },
        {
          id: 'classes',
          icon: Icons.Play,
          label: 'Video classes',
          description: 'Watch programs and lessons',
          href: classRoutes.video,
        },
        {
          id: 'audio-classes',
          icon: Icons.Radio,
          label: 'Audio classes',
          description: 'Listen on the go',
          href: classRoutes.audio,
        },
        {
          id: 'cowork',
          icon: Icons.Video,
          label: 'Co-Work meetings',
          description: 'Schedule or join sessions',
          href: coWorkRoutes.home,
        },
        {
          id: 'feed',
          icon: Icons.Home,
          label: 'News feed',
          description: 'Community posts and updates',
          href: communityRoutes.home,
        },
        {
          id: 'messages',
          icon: Icons.MessageCircle,
          label: 'Messages',
          description: 'Chat with the community',
          href: chatRoutes.home,
        },
      ],
    },
  ]
}
