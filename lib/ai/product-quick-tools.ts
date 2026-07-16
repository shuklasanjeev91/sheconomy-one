import type { Href } from 'one'

import {
  chatRoutes,
  classRoutes,
  coWorkRoutes,
  commerceRoutes,
  communityRoutes,
  routes,
} from '~/lib/routes'

import type { AiProduct } from './types'

export type ProductQuickTool = {
  id: string
  label: string
  description: string
  /** Opens AI assist with this prompt when set. */
  prompt?: string
  /** Navigates to this href when set (and no prompt, or as secondary). */
  href?: Href
  autoSend?: boolean
}

/**
 * Cross-platform quick tools for each primary tab.
 * Same actions on web, iOS, and Android — no platform-specific APIs.
 */
export function productQuickTools(product: AiProduct): ProductQuickTool[] {
  switch (product) {
    case 'commerce':
      return [
        {
          id: 'buy',
          label: 'Find products',
          description: 'Search women-owned finds',
          prompt: 'Help me find products to buy today',
          href: commerceRoutes.search(),
          autoSend: true,
        },
        {
          id: 'orders',
          label: 'Track order',
          description: 'Check delivery status',
          prompt: 'Help me track my recent orders',
          href: commerceRoutes.orders,
          autoSend: true,
        },
        {
          id: 'cart',
          label: 'Checkout help',
          description: 'Coupons & cart tips',
          prompt: 'Help me finish checkout and apply offers',
          href: commerceRoutes.cart,
          autoSend: true,
        },
        {
          id: 'returns',
          label: 'Returns',
          description: 'Start a return',
          prompt: 'How do I start a return or refund?',
          autoSend: true,
        },
      ]
    case 'community':
      return [
        {
          id: 'post',
          label: 'What to post',
          description: 'Professional post ideas',
          prompt: 'Suggest a professional post topic for today',
          autoSend: true,
        },
        {
          id: 'network',
          label: 'Grow network',
          description: 'People to connect with',
          prompt: 'Suggest how to grow my professional network this week',
          href: communityRoutes.network,
          autoSend: true,
        },
        {
          id: 'jobs',
          label: 'Find jobs',
          description: 'Roles that fit you',
          prompt: 'Help me find roles that fit my profile',
          href: communityRoutes.jobs,
          autoSend: true,
        },
        {
          id: 'comment',
          label: 'Comment tips',
          description: 'Engage thoughtfully',
          prompt: 'Give me professional comment tips for the feed',
          autoSend: true,
        },
      ]
    case 'chat':
      return [
        {
          id: 'start',
          label: 'Start chat',
          description: 'Open a new conversation',
          prompt: 'How do I start a new conversation?',
          href: chatRoutes.home,
          autoSend: true,
        },
        {
          id: 'mute',
          label: 'Mute tips',
          description: 'Quiet a noisy thread',
          prompt: 'How do I mute a noisy conversation?',
          autoSend: true,
        },
        {
          id: 'group',
          label: 'Group chat',
          description: 'Multi-member chats',
          prompt: 'How do group chats work?',
          autoSend: true,
        },
        {
          id: 'icebreaker',
          label: 'Icebreakers',
          description: 'First message ideas',
          prompt: 'Suggest professional icebreaker messages for a new chat',
          autoSend: true,
        },
      ]
    case 'class':
      return [
        {
          id: 'browse',
          label: 'Browse classes',
          description: 'Find a program',
          prompt: 'Help me find a class to enroll in',
          href: classRoutes.home,
          autoSend: true,
        },
        {
          id: 'enroll',
          label: 'Enroll help',
          description: 'How enrollment works',
          prompt: 'How do I enroll in a class or program?',
          autoSend: true,
        },
        {
          id: 'playback',
          label: 'Playback fix',
          description: 'Video/audio issues',
          prompt: 'Video or audio will not play — what should I try?',
          autoSend: true,
        },
        {
          id: 'progress',
          label: 'My learning',
          description: 'Continue lessons',
          prompt: 'Show me how to open my enrolled classes and continue learning',
          autoSend: true,
        },
      ]
    case 'cowork':
      return [
        {
          id: 'host',
          label: 'Host meeting',
          description: 'Start or schedule',
          prompt: 'How do I host a Co-Work meeting?',
          href: coWorkRoutes.schedule,
          autoSend: true,
        },
        {
          id: 'join',
          label: 'Join with code',
          description: 'Enter a meeting code',
          prompt: 'How do I join a meeting with a code?',
          href: coWorkRoutes.join,
          autoSend: true,
        },
        {
          id: 'av',
          label: 'Camera / mic',
          description: 'Fix AV permissions',
          prompt: 'Camera or mic is blocked — how do I fix it?',
          autoSend: true,
        },
        {
          id: 'ai-draft',
          label: 'AI schedule',
          description: 'Draft with AI',
          prompt: 'Help me draft a professional meeting agenda for a team sync',
          href: coWorkRoutes.schedule,
          autoSend: false,
        },
      ]
    case 'shop':
      return [
        {
          id: 'orders',
          label: 'New orders',
          description: 'Fulfill sales',
          prompt: 'Show me how to manage new shop orders',
          href: commerceRoutes.manageShop(),
          autoSend: true,
        },
        {
          id: 'stock',
          label: 'Low stock',
          description: 'Restock listings',
          prompt: 'What should I do about low-stock listings?',
          autoSend: true,
        },
        {
          id: 'listing',
          label: 'New listing',
          description: 'Create a product',
          prompt: 'How do I create a new product listing?',
          autoSend: true,
        },
        {
          id: 'boost',
          label: 'Boost sales',
          description: 'Growth tips',
          prompt: 'How can I increase my shop sales this week?',
          autoSend: true,
        },
      ]
    default:
      return [
        {
          id: 'settings',
          label: 'Notifications',
          description: 'Tune alerts',
          prompt: 'Help me tune alerts across products',
          href: routes.settings,
          autoSend: true,
        },
        {
          id: 'help',
          label: 'Help Center',
          description: 'FAQs & support',
          href: routes.help,
        },
        {
          id: 'shop',
          label: 'Marketplace',
          description: 'Start shopping',
          prompt: 'I want to buy something on the marketplace',
          href: commerceRoutes.home,
          autoSend: true,
        },
      ]
  }
}

/** Local AI suggestion chips when the edge function / DB is empty. */
export function localAiSuggestionChips(
  product: AiProduct,
  contextPage = 'home',
): Array<{ id: string; suggestion_text: string; suggestion_action: string }> {
  return productQuickTools(product)
    .filter((tool) => tool.prompt)
    .slice(0, contextPage === 'home' ? 6 : 4)
    .map((tool) => ({
      id: `local-${product}-${tool.id}`,
      suggestion_text: tool.label,
      suggestion_action: tool.prompt!,
    }))
}
