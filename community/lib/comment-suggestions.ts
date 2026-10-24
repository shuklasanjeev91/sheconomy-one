/**
 * Professional comment starters keyed by post type.
 * Used instantly in the UI; AI can refine via ai-assist `comment_suggestions`.
 */

export type CommentSuggestionContext = {
  postType?: string | null
  content?: string | null
  authorName?: string | null
  eventTitle?: string | null
  celebrationTitle?: string | null
  productTitle?: string | null
  shopName?: string | null
  articleTitle?: string | null
  hasMedia?: boolean
  parentComment?: string | null
}

export function commentSuggestionContextKey(ctx: CommentSuggestionContext): string {
  return JSON.stringify({
    postType: ctx.postType ?? null,
    content: ctx.content?.slice(0, 500) ?? null,
    authorName: ctx.authorName ?? null,
    eventTitle: ctx.eventTitle ?? null,
    celebrationTitle: ctx.celebrationTitle ?? null,
    productTitle: ctx.productTitle ?? null,
    shopName: ctx.shopName ?? null,
    articleTitle: ctx.articleTitle ?? null,
    hasMedia: Boolean(ctx.hasMedia),
    parentComment: ctx.parentComment?.slice(0, 500) ?? null,
  })
}

function firstName(name?: string | null) {
  const trimmed = name?.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? trimmed
}

/** Instant, on-device suggestions — no network required. */
export function localCommentSuggestions(ctx: CommentSuggestionContext): string[] {
  const name = firstName(ctx.authorName)
  const type = (ctx.postType || (ctx.hasMedia ? 'media' : 'text')).toLowerCase()
  const event = ctx.eventTitle?.trim()
  const celebration = ctx.celebrationTitle?.trim()
  const product = ctx.productTitle?.trim()
  const shop = ctx.shopName?.trim()
  const article = ctx.articleTitle?.trim()

  switch (type) {
    case 'celebration':
      return [
        celebration
          ? `Congratulations on ${celebration}! 🎉 So well deserved.`
          : `Congratulations${name ? `, ${name}` : ''}! 🎉 Wishing you all the best.`,
        'This is such wonderful news — celebrating with you!',
        'So happy for you. Keep shining!',
      ]
    case 'event':
      return [
        event
          ? `This looks great — just marked my interest for “${event}”.`
          : 'Sounds valuable. Is there a way to RSVP or get a reminder?',
        'Thanks for sharing the details. Looking forward to this!',
        'Would love to join. Any prep we should do beforehand?',
      ]
    case 'poll':
      return [
        'Interesting options — just voted. Curious what others think.',
        'Great question. The results will be insightful.',
        'Thanks for putting this up — helped me clarify my own view.',
      ]
    case 'product':
      return [
        product
          ? `This ${product} looks lovely — is it available to ship soon?`
          : 'Beautiful find! Where can I learn more or buy this?',
        'Love the details. Do you have size/colour options?',
        'Bookmarking this — thanks for sharing!',
      ]
    case 'shop':
      return [
        shop
          ? `Love what you’re building with ${shop}. Following along!`
          : 'Your shop looks inspiring — just checked it out.',
        'Amazing curation. Do you ship nationwide?',
        'Rooting for more women-led brands like this ✨',
      ]
    case 'article':
      return [
        article
          ? `Really thoughtful piece on “${article}”. Thanks for writing this.`
          : 'Insightful read — appreciated the practical takeaways.',
        'This resonated. Going to share with my network.',
        'Clear and useful. Do you have a follow-up on next steps?',
      ]
    case 'repost':
      return [
        'Thanks for amplifying this — important share.',
        'Glad this is getting more eyes. Agree with the message.',
        name ? `Appreciate you resharing this, ${name}.` : 'Appreciate you resharing this.',
      ]
    case 'media':
      return [
        'These visuals are stunning — thanks for sharing!',
        'Love the energy in this. What inspired it?',
        'Beautiful capture. More of this, please!',
      ]
    default:
      return [
        name
          ? `Thanks for sharing this, ${name} — really insightful.`
          : 'Thanks for sharing this — really insightful.',
        'This resonates. What’s the next step you’re focusing on?',
        'Great perspective. Bookmarking to revisit later.',
        'Appreciate you putting this out there for the community.',
      ]
  }
}
