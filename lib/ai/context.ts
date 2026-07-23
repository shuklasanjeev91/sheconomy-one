import {
  isChatPath,
  isClassPath,
  isCoWorkPath,
  isCommunityPath,
  isVendorPath,
  routes,
} from '~/lib/routes'

import type { AiProduct, AiRouteContext } from './types'

function normalizePath(pathname: string) {
  if (!pathname) return '/'
  const trimmed = pathname.split('?')[0]?.split('#')[0] || '/'
  return trimmed.length > 1 && trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

/**
 * Derive AI product + page context from the current path.
 * Keeps chip sets and grounding aligned with the active tab.
 */
export function resolveAiRouteContext(pathname: string): AiRouteContext {
  const path = normalizePath(pathname)
  const segments = path.split('/').filter(Boolean)

  if (isVendorPath(path) || path === '/create-my-shop' || path.startsWith('/create-my-shop/')) {
    return {
      product: 'shop',
      contextPage: path.includes('/settings')
        ? 'settings'
        : path.includes('/orders')
          ? 'orders'
          : path.includes('/products') || path.includes('/create-listing')
            ? 'listings'
            : 'dashboard',
      context: {
        route: path,
      },
    }
  }

  if (isCommunityPath(path)) {
    let contextPage = 'feed'
    if (path.includes('/jobs')) contextPage = 'jobs'
    else if (path.includes('/network') || path.includes('/people')) contextPage = 'network'
    else if (path.includes('/groups')) contextPage = 'groups'
    else if (path.includes('/events')) contextPage = 'events'
    return { product: 'community', contextPage, context: { route: path } }
  }

  if (isChatPath(path)) {
    const chatId = segments[0] === 'chat' && segments[1] && !['groups', 'calls'].includes(segments[1])
      ? segments[1]
      : undefined
    return {
      product: 'chat',
      contextPage: chatId ? 'thread' : 'home',
      context: { route: path, ...(chatId ? { chat_id: chatId } : {}) },
    }
  }

  if (isClassPath(path)) {
    return { product: 'class', contextPage: 'home', context: { route: path } }
  }

  if (isCoWorkPath(path)) {
    const meetingCode =
      segments[0] === 'co-work' && segments[1] === 'meeting' && segments[2] ? segments[2] : undefined
    return {
      product: 'cowork',
      contextPage: meetingCode ? 'meeting' : 'home',
      context: { route: path, ...(meetingCode ? { meeting_id: meetingCode } : {}) },
    }
  }

  if (path === routes.settings || path.startsWith(`${routes.settings}/`)) {
    return { product: 'account', contextPage: 'settings', context: { route: path } }
  }

  if (path === routes.help || path.startsWith(`${routes.help}/`)) {
    return { product: 'account', contextPage: 'help', context: { route: path } }
  }

  if (path === routes.profile || path.startsWith(`${routes.profile}/`)) {
    return { product: 'account', contextPage: 'profile', context: { route: path } }
  }

  // Commerce (default marketplace surface)
  let contextPage = 'home'
  if (path === '/cart' || path.startsWith('/cart/') || path === '/checkout') contextPage = 'cart'
  else if (path.startsWith('/listing/')) contextPage = 'listing'
  else if (path.startsWith('/orders')) contextPage = 'orders'
  else if (path.startsWith('/shop/')) contextPage = 'shop'

  const listingSlug = path.startsWith('/listing/') ? segments[1] : undefined
  const shopSlug = path.startsWith('/shop/') ? segments[1] : undefined

  return {
    product: 'commerce',
    contextPage,
    context: {
      route: path,
      ...(listingSlug ? { listing_slug: listingSlug } : {}),
      ...(shopSlug ? { shop_slug: shopSlug } : {}),
    },
  }
}

export function aiProductLabel(product: AiProduct): string {
  switch (product) {
    case 'commerce':
      return 'Marketplace'
    case 'community':
      return 'Community'
    case 'chat':
      return 'Chat'
    case 'class':
      return 'Class'
    case 'cowork':
      return 'Co-Work'
    case 'shop':
      return 'Manage Shop'
    case 'account':
      return 'Account'
  }
}
