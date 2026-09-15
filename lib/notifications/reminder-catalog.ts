/** Catalog of cross-platform reminder families (in-app + push + email where enabled). */
export type ReminderFamily = {
  id: string
  title: string
  description: string
  settingsSection:
    | 'commerce'
    | 'co-work'
    | 'class'
    | 'shop'
    | 'community'
    | 'notifications'
  examples: string[]
}

export const REMINDER_FAMILIES: ReminderFamily[] = [
  {
    id: 'cart',
    title: 'Cart recovery',
    description: 'Gentle nudges when items stay in your cart',
    settingsSection: 'commerce',
    examples: ['Abandoned cart (in-app, email, push, WhatsApp)'],
  },
  {
    id: 'orders',
    title: 'Orders',
    description: 'Status updates from placed to delivered, including return and refund progress',
    settingsSection: 'commerce',
    examples: ['Order placed', 'Shipped', 'Out for delivery', 'Delivered', 'Refund ETA update'],
  },
  {
    id: 'stock',
    title: 'Stock & restock',
    description: 'Back-in-stock alerts for buyers plus low-stock alerts for sellers',
    settingsSection: 'commerce',
    examples: ['Notify me when available', 'Back in stock again', 'Low stock alert (sellers)'],
  },
  {
    id: 'followed-shop-updates',
    title: 'Followed shop updates',
    description: 'In-app digests and future alerts from shops you follow',
    settingsSection: 'commerce',
    examples: ['New arrivals from followed shops', 'Price drop from followed shop', 'Saved item overlap'],
  },
  {
    id: 'reorder-care',
    title: 'Reorder & care',
    description: 'Post-purchase reminders to buy again, review, or revisit care guidance',
    settingsSection: 'commerce',
    examples: ['Buy again reminder', 'Review then reorder nudge', 'Care follow-up after delivery'],
  },
  {
    id: 'cowork',
    title: 'Co-Work meetings',
    description: 'Invites, Zoom-style reminders (3h, 2h, 1h, 30m, 15m), join requests, and live-join alerts',
    settingsSection: 'co-work',
    examples: [
      'Meeting invite',
      '3h / 2h / 1h / 30m / 15m reminders',
      'Waiting-room join request',
      'Someone joined',
    ],
  },
  {
    id: 'class',
    title: 'Classes & programs',
    description: 'Enrollment and new lesson alerts',
    settingsSection: 'class',
    examples: ['Enrollment confirmed', 'New lesson published'],
  },
  {
    id: 'events',
    title: 'Community events',
    description: 'Reminders for events you registered for',
    settingsSection: 'community',
    examples: ['1 hour before', '15 minutes before'],
  },
  {
    id: 'shop',
    title: 'Seller ops',
    description: 'New orders and confirmation nudges for your shop',
    settingsSection: 'shop',
    examples: ['New order', 'Confirm order reminder', 'Out of stock'],
  },
]
