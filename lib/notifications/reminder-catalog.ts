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
    description: 'Status updates from placed to delivered',
    settingsSection: 'commerce',
    examples: ['Order placed', 'Shipped', 'Out for delivery', 'Delivered'],
  },
  {
    id: 'stock',
    title: 'Stock & restock',
    description: 'Back-in-stock for buyers; low-stock for sellers',
    settingsSection: 'commerce',
    examples: ['Notify me when available', 'Low stock alert (sellers)'],
  },
  {
    id: 'cowork',
    title: 'Co-Work meetings',
    description: 'Invites plus 30- and 5-minute reminders before start',
    settingsSection: 'co-work',
    examples: ['Meeting invite', '30 min reminder', '5 min reminder'],
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
