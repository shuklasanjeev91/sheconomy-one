import type { HelpArticle, HelpProduct } from './types'

/** Static FAQ used when the knowledge base is empty or unreachable. */
export const FAQ_FALLBACK: HelpArticle[] = [
  {
    id: 'fallback-commerce-orders',
    title: 'How do I track my order?',
    content:
      'Open Orders from your account menu. Each order shows status from placed to delivered, plus tracking when available.',
    category: 'commerce',
    tags: ['orders'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'track-order',
  },
  {
    id: 'fallback-commerce-returns',
    title: 'How do returns work?',
    content:
      'Check Shipping & policies on the listing, then start a return from Order details when the shop policy allows it.',
    category: 'commerce',
    tags: ['returns'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'returns',
  },
  {
    id: 'fallback-commerce-cart',
    title: 'How do I checkout from my cart?',
    content:
      'Open Cart, review quantities and offers, then tap Checkout. Add an address and payment method if prompted. You can save items for later from the cart.',
    category: 'commerce',
    tags: ['cart', 'checkout'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'checkout-cart',
  },
  {
    id: 'fallback-commerce-payment-methods',
    title: 'Where do I manage payment methods?',
    content:
      'Open Payment methods from your account menu. Add or remove cards, then select one during checkout. Declines often need a bank OTP or another saved method.',
    category: 'commerce',
    tags: ['payments'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'payment-methods',
  },
  {
    id: 'fallback-shop-create',
    title: 'How do I create a shop?',
    content:
      'Open Manage shop / Create shop from the menu and complete onboarding. Edit settings anytime from the seller hub.',
    category: 'shop',
    tags: ['seller'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'create-shop',
  },
  {
    id: 'fallback-shop-payouts',
    title: 'When do sellers get paid?',
    content:
      'Payout timing depends on order fulfillment and your payment/payout settings in Manage shop. Confirm shipping, resolve issues, and keep bank details up to date under Payments.',
    category: 'shop',
    tags: ['payouts', 'seller'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'seller-payouts',
  },
  {
    id: 'fallback-shop-low-stock',
    title: 'What should I do about low stock?',
    content:
      'Open Manage shop → Listings, update stock quantities, and republish. Listings at zero stock are hidden from browse until restocked.',
    category: 'shop',
    tags: ['inventory', 'listings'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'low-stock',
  },
  {
    id: 'fallback-community-connections',
    title: 'How do connection requests work?',
    content:
      'Send a request from a profile. You will be notified when someone accepts, based on your Community alert settings.',
    category: 'community',
    tags: ['network'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'connections',
  },
  {
    id: 'fallback-community-jobs',
    title: 'How do Community jobs work?',
    content:
      'Browse Jobs under Community, open a role, and apply or save it. Keep your profile headline and experience current so matches look credible.',
    category: 'community',
    tags: ['jobs'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'community-jobs',
  },
  {
    id: 'fallback-community-saved',
    title: 'Where are my saved posts?',
    content:
      'Open Community → Saved to see posts you bookmarked. You can unsave from the post menu anytime.',
    category: 'community',
    tags: ['saved'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'saved-posts',
  },
  {
    id: 'fallback-chat-start',
    title: 'How do I start a chat?',
    content: 'Open Chat → New message, pick a contact, and send your first note. Groups live under the Groups tab.',
    category: 'chat',
    tags: ['messaging'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'start-chat',
  },
  {
    id: 'fallback-chat-block',
    title: 'Can I block or report someone in chat?',
    content:
      'Open the conversation menu for mute, leave, or report options where available. For serious harm, also Report from Community profiles and contact support with Chat selected.',
    category: 'chat',
    tags: ['safety', 'block'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'chat-safety',
  },
  {
    id: 'fallback-chat-media',
    title: 'Why will my photo not send?',
    content:
      'Check file size and network, then retry. Large attachments may fail on slow connections — try a smaller image or send a link instead.',
    category: 'chat',
    tags: ['attachments'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'chat-attachments',
  },
  {
    id: 'fallback-class-enroll',
    title: 'How do I enroll in a class?',
    content:
      'Open Class, choose a course or program, and enroll when available. Confirmation alerts follow your Class notification settings.',
    category: 'class',
    tags: ['enrollment'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'enroll-class',
  },
  {
    id: 'fallback-class-certificates',
    title: 'Do classes offer certificates?',
    content:
      'Some programs show completion status in Class. Check the program details for certificate or badge wording; contact support with the course title if something is missing after you finish.',
    category: 'class',
    tags: ['certificates'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'class-certificates',
  },
  {
    id: 'fallback-class-refund',
    title: 'Can I get a refund on a paid class?',
    content:
      'Refund rules depend on the program listing. Review the course details before enrolling, then contact support with product Class and the course name if you need a review.',
    category: 'class',
    tags: ['refunds'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'class-refunds',
  },
  {
    id: 'fallback-cowork-host',
    title: 'How do I host a Co-Work meeting?',
    content:
      'Open Co-Work to schedule or start a meeting, then share the code or invite link. Hosts get waiting-room and mute controls.',
    category: 'cowork',
    tags: ['meetings'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'host-meeting',
  },
  {
    id: 'fallback-cowork-waiting-room',
    title: 'What is the waiting room?',
    content:
      'Hosts can admit or hold participants before they join the live room. If you are waiting, stay on the screen until the host lets you in, or ask them to resend the invite.',
    category: 'cowork',
    tags: ['waiting-room'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'waiting-room',
  },
  {
    id: 'fallback-cowork-recording',
    title: 'Can meetings be recorded?',
    content:
      'Recording depends on host controls and plan settings. If recording is on, participants are typically notified in-room. Ask the host before sharing sensitive material.',
    category: 'cowork',
    tags: ['recording'],
    helpful_count: 0,
    view_count: 0,
    source: 'fallback',
    slug: 'meeting-recording',
  },
]

/** Contact form templates — prefill subject/description per product. */
export const CONTACT_TEMPLATES: Array<{
  product: Exclude<HelpProduct, ''>
  label: string
  subject: string
  description: string
}> = [
  {
    product: 'commerce',
    label: 'Order issue',
    subject: 'Order issue',
    description: 'Order number:\nWhat went wrong:\n',
  },
  {
    product: 'commerce',
    label: 'Return / refund',
    subject: 'Return or refund help',
    description: 'Order number:\nItem:\nWhat I need help with:\n',
  },
  {
    product: 'shop',
    label: 'Seller orders',
    subject: 'Seller order help',
    description: 'Shop name:\nOrder / listing:\nIssue:\n',
  },
  {
    product: 'community',
    label: 'Safety report',
    subject: 'Community safety report',
    description: 'Profile / post link:\nWhat happened:\n',
  },
  {
    product: 'chat',
    label: 'Mute / privacy',
    subject: 'Chat mute or privacy help',
    description: 'Conversation type (DM/group):\nWhat I need:\n',
  },
  {
    product: 'class',
    label: 'Playback issue',
    subject: 'Class playback issue',
    description: 'Course / lesson title:\nDevice / browser:\nWhat happens:\n',
  },
  {
    product: 'cowork',
    label: 'AV blocked',
    subject: 'Camera or mic blocked in Co-Work',
    description: 'Meeting code:\nDevice:\nWhat I already tried:\n',
  },
]

export function filterFallbackArticles(product: HelpProduct, query: string): HelpArticle[] {
  const q = query.trim().toLowerCase()
  return FAQ_FALLBACK.filter((article) => {
    if (product && article.category !== product) return false
    if (!q) return true
    return (
      article.title.toLowerCase().includes(q) ||
      article.content.toLowerCase().includes(q) ||
      (article.tags ?? []).some((tag) => tag.toLowerCase().includes(q)) ||
      (article.slug ?? '').toLowerCase().includes(q)
    )
  })
}

export function contactTemplatesFor(product: Exclude<HelpProduct, ''>) {
  return CONTACT_TEMPLATES.filter((t) => t.product === product)
}
