import type { Href } from 'one'

import { Icons } from '~/components/ui'
import {
  type AccessTier,
  type AppFeature,
  canManageShops,
  resolveFeatureNavHref,
} from '~/lib/auth/access'
import { buildSignInUrl } from '~/lib/auth/redirect'
import {
  chatRoutes,
  classRoutes,
  coWorkRoutes,
  commerceRoutes,
  communityRoutes,
  routes,
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
  /** Show Admin console link when the signed-in user has admin role. */
  isAdmin?: boolean
  /**
   * Mobile / compact chrome already shows center + bottom tabs.
   * When true, omit destinations that those tabs already cover.
   */
  omitChromeDuplicates?: boolean
}

const ADMIN_HOME = '/admin' as Href

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

/** Pinned shopping shortcuts — not repeated in sections below. */
export function getAccountQuickActions({
  tier,
  cartCount,
  wishlistCount,
  omitChromeDuplicates = false,
}: Pick<
  AccountMenuOptions,
  'tier' | 'cartCount' | 'wishlistCount' | 'omitChromeDuplicates'
>): AccountQuickAction[] {
  const actions: AccountQuickAction[] = [
    {
      id: 'orders',
      icon: Icons.Package,
      label: 'Orders',
      href: item(tier, 'orders', Icons.Package, '', commerceRoutes.orders, 'commerce').href,
    },
  ]

  // Cart is already a mobile bottom tab — keep it on desktop only.
  if (!omitChromeDuplicates) {
    actions.push({
      id: 'cart',
      icon: Icons.ShoppingBag,
      label: 'Cart',
      href: item(tier, 'cart', Icons.ShoppingBag, '', commerceRoutes.cart, 'commerce').href,
      ...badge(cartCount),
    })
  }

  actions.push({
    id: 'wishlist',
    icon: Icons.Heart,
    label: 'Wishlist',
    href: item(tier, 'wishlist', Icons.Heart, '', commerceRoutes.wishlist, 'commerce').href,
    ...badge(wishlistCount),
  })

  return actions
}

/** Account drawer sections — destinations not already covered by chrome. */
export function getAccountMenuSections({
  tier,
  hasShops,
  isAdmin = false,
  omitChromeDuplicates = false,
}: Pick<
  AccountMenuOptions,
  'tier' | 'hasShops' | 'primaryShopId' | 'isAdmin' | 'omitChromeDuplicates'
>): AccountMenuSection[] {
  const sections: AccountMenuSection[] = []

  sections.push({
    id: 'account',
    title: 'Your account',
    subtitle: 'Preferences and security',
    items: [
      item(tier, 'settings', Icons.Settings, 'Settings & privacy', routes.settings, 'account', {
        description: 'Account, appearance, and alerts per product',
      }),
      item(tier, 'profile', Icons.User, 'Your profile', routes.profile, 'account', {
        description: 'Photo, headline, and career preferences',
      }),
      item(tier, 'notifications', Icons.Bell, 'Notifications', routes.notifications, 'account', {
        description: 'Alerts from marketplace, community, and chat',
      }),
      item(tier, 'help', Icons.HelpCircle, 'Help & Support', routes.help, 'account', {
        description: 'FAQs and contact for every tab',
      }),
      item(tier, 'ai-assist', Icons.Sparkles, 'Ask SHEconomy AI', routes.help, 'account', {
        description: 'Contextual help for every product',
        action: 'open-ai',
      }),
    ],
  })

  if (isAdmin) {
    sections.push({
      id: 'admin',
      title: 'Admin',
      subtitle: 'Platform console',
      items: [
        {
          id: 'admin-console',
          icon: Icons.ShieldCheck,
          label: 'Admin',
          description: 'Users, shops, orders, and platform tools',
          href: ADMIN_HOME,
        },
      ],
    })
  }

  // Quick actions already cover Orders / Cart / Wishlist — only shops + payments here.
  sections.push({
    id: 'marketplace',
    title: 'Marketplace',
    subtitle: 'Shop discovery and checkout',
    items: [
      ...(omitChromeDuplicates
        ? []
        : [
            item(tier, 'shops', Icons.Store, 'Browse shops', commerceRoutes.shops, 'commerce', {
              description: 'Independent storefronts',
            }),
          ]),
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
    const shopManagerHref = hasShops ? commerceRoutes.manageShop() : commerceRoutes.createShop

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

  // Community: bottom tabs already cover Network / Create / Jobs on mobile.
  const communityItems: AccountMenuItem[] = omitChromeDuplicates
    ? [
        item(tier, 'groups', Icons.UsersRound, 'Groups', communityRoutes.groups, 'community', {
          description: 'Communities you follow or manage',
        }),
        item(tier, 'events', Icons.CalendarDays, 'Events', communityRoutes.events, 'community', {
          description: 'Meetups and community gatherings',
        }),
        item(tier, 'pages', Icons.Building2, 'Pages', communityRoutes.companies, 'community', {
          description: 'Business and creator pages',
        }),
        item(tier, 'stories', Icons.Film, 'Stories', communityRoutes.stories, 'community', {
          description: 'Short updates from people you follow',
        }),
        item(tier, 'saved', Icons.Bookmark, 'Saved posts', communityRoutes.saved, 'community', {
          description: 'Posts you bookmarked',
        }),
      ]
    : [
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
      ]

  sections.push({
    id: 'social',
    title: 'Community',
    subtitle: omitChromeDuplicates ? 'More community tools' : 'Feed tools and pages',
    items: communityItems.filter(Boolean),
  })

  // Chat / Classes / Co-Work homes are center-nav tabs; keep only deep tools.
  if (!omitChromeDuplicates) {
    sections.push({
      id: 'messaging',
      title: 'Chat',
      subtitle: 'Conversations',
      items: [
        item(tier, 'groups-chat', Icons.Users, 'Group chats', chatRoutes.groups, 'chat', {
          description: 'Multi-member conversations',
        }),
        item(tier, 'calls', Icons.Phone, 'Calls', chatRoutes.calls, 'chat', {
          description: 'Voice and video call history',
        }),
      ],
    })

    sections.push({
      id: 'classes',
      title: 'Class',
      subtitle: 'Videos and audio to watch',
      items: [
        item(tier, 'video', Icons.Play, 'Video', classRoutes.video, 'class', {
          description: 'Browse and play recorded videos',
        }),
        item(tier, 'audio', Icons.Radio, 'Audio', classRoutes.audio, 'class', {
          description: 'Browse and play recorded audio',
        }),
      ],
    })

    sections.push({
      id: 'co-work',
      title: 'Co-Work',
      subtitle: 'Meetings and collaboration',
      items: [
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
  }

  return sections.filter((section) => section.items.length > 0)
}

/** Guest drawer — browse destinations not already on chrome. */
export function getGuestAccountMenuSections(
  options?: { omitChromeDuplicates?: boolean },
): AccountMenuSection[] {
  const omit = options?.omitChromeDuplicates ?? false

  return [
    {
      id: 'shopping',
      title: 'Shopping',
      subtitle: 'No account needed',
      items: [
        ...(omit
          ? []
          : [
              {
                id: 'marketplace',
                icon: Icons.Home,
                label: 'Browse marketplace',
                description: 'Discover shops and handmade finds',
                href: commerceRoutes.home,
              } satisfies AccountMenuItem,
            ]),
        {
          id: 'shops',
          icon: Icons.Store,
          label: 'Explore shops',
          description: 'Independent storefronts',
          href: commerceRoutes.shops,
        },
        ...(omit
          ? []
          : [
              {
                id: 'cart',
                icon: Icons.ShoppingBag,
                label: 'Cart',
                description: 'Items you added while browsing',
                href: commerceRoutes.cart,
              } satisfies AccountMenuItem,
            ]),
      ].filter(Boolean),
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
          href: buildSignInUrl(String(commerceRoutes.createShop)) as Href,
        },
      ],
    },
  ].filter((section) => section.items.length > 0)
}
