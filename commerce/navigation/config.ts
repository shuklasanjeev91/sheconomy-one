import type { Href } from 'one'

import { BRAND_NAME } from '~/config/brand'
import { commerceRoutes, communityRoutes, routes } from '~/lib/routes'

export type NavLinkItem = {
  href: Href
  label: string
}

export const COMMERCE_FOOTER_COLUMNS: { title: string; links: NavLinkItem[] }[] = [
  {
    title: 'Shop',
    links: [
      { href: commerceRoutes.shops, label: 'Browse shops' },
      { href: commerceRoutes.browse('trending'), label: 'Trending listings' },
      { href: commerceRoutes.favorites, label: 'Favorites' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { href: routes.signIn, label: 'Get started selling' },
      { href: commerceRoutes.myShops, label: 'Seller dashboard' },
      { href: `${commerceRoutes.myShops}?create=1` as Href, label: 'Open your shop' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: communityRoutes.home, label: `${BRAND_NAME} feed` },
      { href: communityRoutes.network, label: 'Your network' },
      { href: communityRoutes.jobs, label: 'Jobs' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: communityRoutes.home, label: `About ${BRAND_NAME}` },
      { href: communityRoutes.jobs, label: 'Careers' },
      { href: communityRoutes.companies, label: 'Press' },
    ],
  },
]

export const COMMERCE_FOOTER_LEGAL: NavLinkItem[] = [
  { href: routes.settings, label: 'Terms of use' },
  { href: routes.settings, label: 'Privacy' },
  { href: routes.settings, label: 'Cookies' },
  { href: routes.settings, label: 'Interest-based ads' },
]
