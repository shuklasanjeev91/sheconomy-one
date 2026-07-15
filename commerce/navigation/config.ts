import type { Href } from 'one'

import { BRAND_NAME } from '~/config/brand'
import { helpHref } from '~/lib/help/types'
import {
  appRoutes,
  classRoutes,
  commerceRoutes,
  communityRoutes,
  coWorkRoutes,
  routes,
} from '~/lib/routes'

export type NavLinkItem = {
  href: Href
  label: string
}

/** Etsy-style footer columns — every href must resolve to a real in-app route. */
export const COMMERCE_FOOTER_COLUMNS: { title: string; links: NavLinkItem[] }[] = [
  {
    title: 'Shop',
    links: [
      { href: commerceRoutes.shops, label: 'Browse shops' },
      { href: commerceRoutes.browse('trending'), label: 'Trending' },
      { href: commerceRoutes.browse('latest'), label: 'New arrivals' },
      { href: commerceRoutes.browse('featured'), label: 'Featured' },
      { href: commerceRoutes.search(), label: 'Search' },
      { href: commerceRoutes.favorites, label: 'Favorites' },
      { href: commerceRoutes.orders, label: 'Your orders' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { href: commerceRoutes.createShop, label: `Sell on ${BRAND_NAME}` },
      { href: commerceRoutes.myShops, label: 'Your shops' },
      { href: appRoutes.helpProduct('shop'), label: 'Seller help' },
      { href: routes.signIn, label: 'Create account' },
      { href: appRoutes.settingsSection('shop'), label: 'Shop settings' },
      { href: appRoutes.settingsSection('commerce'), label: 'Commerce settings' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: appRoutes.settingsSection('about'), label: `About ${BRAND_NAME}` },
      { href: communityRoutes.home, label: 'Community' },
      { href: communityRoutes.jobs, label: 'Careers' },
      { href: communityRoutes.companies, label: 'Companies' },
      { href: communityRoutes.events, label: 'Events' },
      { href: classRoutes.home, label: 'Classes' },
      { href: coWorkRoutes.home, label: 'Co-Work' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: appRoutes.help, label: 'Help Center' },
      { href: `${appRoutes.help}?tab=contact` as Href, label: 'Contact us' },
      { href: helpHref('commerce') as Href, label: 'Buying help' },
      { href: helpHref('chat', 'chat-safety') as Href, label: 'Safety' },
      { href: appRoutes.settingsSection('privacy'), label: 'Privacy settings' },
      { href: appRoutes.settings, label: 'Account settings' },
      { href: commerceRoutes.paymentMethods, label: 'Payment methods' },
    ],
  },
]

export const COMMERCE_FOOTER_LEGAL: NavLinkItem[] = [
  { href: appRoutes.legalTerms, label: 'Terms of use' },
  { href: appRoutes.legalPrivacy, label: 'Privacy' },
  { href: appRoutes.legalCookies, label: 'Cookies' },
  { href: appRoutes.legalAds, label: 'Interest-based ads' },
]
