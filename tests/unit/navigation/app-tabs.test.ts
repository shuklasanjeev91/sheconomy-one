import { beforeEach, describe, expect, it, vi } from 'vitest'

const openComposer = vi.fn()
const openNewChat = vi.fn()

vi.mock('~/community/lib/composer-store', () => ({
  openComposer: (...args: unknown[]) => openComposer(...args),
}))

vi.mock('~/chat/lib/chat-actions-store', () => ({
  openNewChat: (...args: unknown[]) => openNewChat(...args),
}))

vi.mock('~/components/ui', () => {
  const Icon = () => null
  return {
    Icons: new Proxy(
      {},
      {
        get: () => Icon,
      },
    ),
  }
})

vi.mock('~/lib/theme/app-ui', () => ({
  appUiLight: {
    brand: '#d81b60',
    icon: '#666',
    iconActive: '#d81b60',
    border: '#eee',
    borderSubtle: '#f5f5f5',
    surface: '#fff',
    surfaceMuted: '#fafafa',
    background: '#fff',
    chip: '#f0f0f0',
    chipHover: '#e8e8e8',
    text: '#111',
    textSecondary: '#666',
    danger: '#c00',
    onBrand: '#fff',
  },
}))

import {
  APP_CENTER_NAV,
  APP_CHAT_MOBILE_TABS,
  APP_CLASS_MOBILE_TABS,
  APP_COMMUNITY_MOBILE_TABS,
  APP_COWORK_MOBILE_TABS,
  buildMobileBottomTabs,
  getCommerceMobileTabs,
  getMobileBottomTabMiddleTabs,
  getMobileBottomTabSection,
  getVendorMobileTabs,
} from '~/components/navigation/app/config'
import {
  chatRoutes,
  classRoutes,
  coWorkRoutes,
  commerceRoutes,
  communityRoutes,
  vendorRoutes,
} from '~/lib/routes'

describe('APP_CENTER_NAV', () => {
  it('covers every product section with a real href + matcher', () => {
    const labels = APP_CENTER_NAV.map((item) => item.label)
    expect(labels).toEqual(['Commerce', 'Community', 'Chat', 'Class', 'Co-Work'])

    for (const item of APP_CENTER_NAV) {
      expect(String(item.href)).toMatch(/^\//)
      expect(item.match(String(item.href))).toBe(true)
      expect(typeof item.icon).toBe('function')
      expect(item.feature).toBeTruthy()
    }
  })

  it('matchers do not overlap across unrelated sections', () => {
    expect(APP_CENTER_NAV.find((i) => i.label === 'Commerce')!.match('/community')).toBe(false)
    expect(APP_CENTER_NAV.find((i) => i.label === 'Community')!.match('/chat')).toBe(false)
    expect(APP_CENTER_NAV.find((i) => i.label === 'Chat')!.match('/class')).toBe(false)
    expect(APP_CENTER_NAV.find((i) => i.label === 'Class')!.match('/co-work')).toBe(false)
    expect(APP_CENTER_NAV.find((i) => i.label === 'Co-Work')!.match('/')).toBe(false)
  })
})

describe('mobile bottom tabs', () => {
  beforeEach(() => {
    openComposer.mockClear()
    openNewChat.mockClear()
  })

  it('maps pathnames to the correct section chrome', () => {
    expect(getMobileBottomTabSection('/')).toBe('commerce')
    expect(getMobileBottomTabSection('/shops')).toBe('commerce')
    expect(getMobileBottomTabSection('/community')).toBe('community')
    expect(getMobileBottomTabSection('/profile')).toBe('community')
    expect(getMobileBottomTabSection('/settings')).toBe('community')
    expect(getMobileBottomTabSection('/notifications')).toBe('community')
    expect(getMobileBottomTabSection('/chat')).toBe('chat')
    expect(getMobileBottomTabSection('/class')).toBe('class')
    expect(getMobileBottomTabSection('/co-work')).toBe('co-work')
    expect(getMobileBottomTabSection('/vendor')).toBe('vendor')
    expect(getMobileBottomTabSection('/vendor/myshop')).toBe('vendor')
    expect(getMobileBottomTabSection('/vendor/orders')).toBe('vendor')
    expect(getMobileBottomTabSection('/auth/sign-in')).toBeNull()
    expect(getMobileBottomTabSection('/ui-kit')).toBeNull()
  })

  it('wires Create Post and New chat to overlay actions (not dead taps)', () => {
    const create = APP_COMMUNITY_MOBILE_TABS.find((t) => t.label === 'Create Post')
    expect(create?.href).toBe(communityRoutes.createPost)
    expect(typeof create?.onPress).toBe('function')
    create!.onPress!()
    expect(openComposer).toHaveBeenCalled()

    const newChat = APP_CHAT_MOBILE_TABS.find((t) => t.label === 'New chat')
    expect(newChat?.href).toBe(chatRoutes.home)
    expect(typeof newChat?.onPress).toBe('function')
    newChat!.onPress!()
    expect(openNewChat).toHaveBeenCalled()
  })

  it('builds Home + middle + You for every section', () => {
    const sections = ['commerce', 'community', 'chat', 'class', 'co-work', 'vendor'] as const
    for (const section of sections) {
      const middle = getMobileBottomTabMiddleTabs(
        section,
        section === 'commerce' ? { hasShops: false } : undefined,
      )
      const tabs = buildMobileBottomTabs(section, middle, 'member')
      expect(tabs.length).toBeGreaterThanOrEqual(3)
      expect(tabs[0]?.label).toMatch(/Home/i)
      expect(tabs.at(-1)?.label).toMatch(/You/i)
      for (const tab of tabs) {
        expect(String(tab.href)).toMatch(/^\//)
      }
    }
  })

  it('keeps commerce seller CTA pointing at create or manage shop', () => {
    const create = getCommerceMobileTabs({ hasShops: false })
    expect(create.some((t) => t.href === commerceRoutes.createShop)).toBe(true)

    const manage = getCommerceMobileTabs({ hasShops: true, primaryShopId: 'shop-1' })
    expect(manage.some((t) => String(t.href).includes('/vendor'))).toBe(true)
  })

  it('exposes Manage Shop tabs: Home, Listings, Orders, Stats, You', () => {
    const middle = getVendorMobileTabs()
    expect(middle.map((t) => t.label)).toEqual(['Listings', 'Orders', 'Stats'])
    expect(middle.map((t) => String(t.href))).toEqual([
      String(vendorRoutes.products),
      String(vendorRoutes.orders),
      String(vendorRoutes.analytics),
    ])

    const tabs = buildMobileBottomTabs('vendor', middle, 'member')
    expect(tabs.map((t) => t.label)).toEqual(['Home', 'Listings', 'Orders', 'Stats', 'You'])
    expect(tabs[0]?.href).toBe(vendorRoutes.myShop)
    expect(tabs.at(-1)?.label).toBe('You')
    expect(tabs[0]?.match?.('/vendor/myshop')).toBe(true)
    expect(middle[0]?.match?.('/vendor/products')).toBe(true)
    expect(middle[1]?.match?.('/vendor/orders')).toBe(true)
  })

  it('exposes class video/audio and co-work schedule/meetings/join', () => {
    expect(APP_CLASS_MOBILE_TABS.map((t) => String(t.href))).toEqual([
      String(classRoutes.video),
      String(classRoutes.audio),
      String(classRoutes.playlists),
    ])
    expect(APP_CLASS_MOBILE_TABS[0]?.match?.('/class')).toBe(false)
    expect(APP_CLASS_MOBILE_TABS[0]?.match?.('/class/video')).toBe(true)
    expect(APP_COWORK_MOBILE_TABS.map((t) => String(t.href))).toEqual([
      String(coWorkRoutes.schedule),
      String(coWorkRoutes.meetings),
      String(coWorkRoutes.join),
    ])
  })

  it('keeps only Home active on Class hub (not Video)', () => {
    const middle = getMobileBottomTabMiddleTabs('class')
    const tabs = buildMobileBottomTabs('class', middle, 'member')
    const home = tabs[0]
    const video = tabs.find((t) => t.label === 'Video')
    expect(home?.match?.('/class')).toBe(true)
    expect(video?.match?.('/class')).toBe(false)
    expect(video?.match?.('/class/video')).toBe(true)
  })
})
