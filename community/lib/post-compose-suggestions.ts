/**
 * Instant, on-device professional compose starters.
 * Works offline on web, iOS, and Android; AI can refine via `post_draft`.
 */

export type ComposeModeHint =
  | 'text'
  | 'poll'
  | 'event'
  | 'celebration'
  | 'product'
  | 'shop'
  | 'article'

export type PostComposeChip = {
  id: string
  label: string
  /** Full draft body ready to paste into the composer. */
  draft: string
  /** Optional article title when mode is article. */
  articleTitle?: string
}

export function localPostComposeSuggestions(mode: ComposeModeHint = 'text'): PostComposeChip[] {
  switch (mode) {
    case 'celebration':
      return [
        {
          id: 'celeb-role',
          label: 'New role',
          draft:
            "Excited to share that I’m starting a new chapter! Grateful for the mentors and community who made this possible — looking forward to learning and contributing more.",
        },
        {
          id: 'celeb-milestone',
          label: 'Milestone',
          draft:
            'Proud to hit a meaningful milestone this week. Thank you to everyone who cheered me on — here’s to what’s next.',
        },
        {
          id: 'celeb-launch',
          label: 'Launch',
          draft:
            'We just launched something I’ve been building for a while. Would love your feedback and support as we grow.',
        },
      ]
    case 'event':
      return [
        {
          id: 'event-invite',
          label: 'Invite',
          draft:
            'I’m hosting a session for founders and builders. Join us for practical takeaways and open Q&A — details below.',
        },
        {
          id: 'event-panel',
          label: 'Panel',
          draft:
            'Excited to moderate a panel on women-led growth. If this topic matters to you, I’d love to see you there.',
        },
      ]
    case 'poll':
      return [
        {
          id: 'poll-career',
          label: 'Career poll',
          draft: 'Quick poll for my network: what skill are you investing in most this quarter?',
        },
        {
          id: 'poll-product',
          label: 'Product poll',
          draft: 'Builders — when validating a new product idea, what do you trust most?',
        },
      ]
    case 'product':
      return [
        {
          id: 'product-drop',
          label: 'Product drop',
          draft:
            'New find from a women-owned brand I’m loving. Thoughtful design, fair pricing, and made with care — worth a look.',
        },
        {
          id: 'product-rec',
          label: 'Recommend',
          draft:
            'If you’re looking for something practical and beautifully made, this listing is a standout. Happy to answer questions.',
        },
      ]
    case 'shop':
      return [
        {
          id: 'shop-spotlight',
          label: 'Shop spotlight',
          draft:
            'Spotlighting a women-owned shop doing thoughtful work. Support small brands — it compounds for our whole community.',
        },
      ]
    case 'article':
      return [
        {
          id: 'article-lessons',
          label: 'Lessons',
          articleTitle: '3 lessons I learned building in public',
          draft:
            'I used to wait for perfect conditions before sharing progress. Publishing in public taught me faster feedback, clearer priorities, and better accountability.\n\nHere’s what changed for me — and what I’d tell anyone starting now.',
        },
        {
          id: 'article-how',
          label: 'How-to',
          articleTitle: 'A simple weekly system for professional growth',
          draft:
            'Growth doesn’t need a complicated stack. One focus skill, one network action, and one reflection each week compounds more than sporadic bursts.\n\nHere’s the system I use.',
        },
      ]
    default:
      return [
        {
          id: 'text-insight',
          label: 'Insight',
          draft:
            'A quick reflection from this week: clarity beats urgency. When I slowed down to define the real problem, the solution became obvious.\n\nWhat’s one thing you’re simplifying right now?',
        },
        {
          id: 'text-ask',
          label: 'Ask network',
          draft:
            'Crowdsourcing advice from this community: what’s one habit that improved your focus at work?\n\nI’ll share what I’m testing in the comments.',
        },
        {
          id: 'text-win',
          label: 'Small win',
          draft:
            'Celebrating a small win today — shipped something I’ve been iterating on quietly. Grateful for the feedback loop this network gives me.',
        },
        {
          id: 'text-hire',
          label: 'Hiring / open',
          draft:
            'I’m open to conversations with people working on [your focus]. If you’re building in this space, I’d love to connect and exchange notes.',
        },
      ]
  }
}

/** Fallback draft when the AI edge action is unavailable. */
export function fallbackPostDraft(prompt: string, mode: ComposeModeHint = 'text'): {
  title: string | null
  content: string
} {
  const topic = prompt.trim().slice(0, 120) || 'this week’s update'
  if (mode === 'article') {
    return {
      title: `Notes on ${topic}`,
      content: `I’ve been thinking about ${topic}.\n\nHere’s the short version of what I’m learning, what I’d do differently, and one question for this community.`,
    }
  }
  if (mode === 'celebration') {
    return {
      title: null,
      content: `Excited to celebrate ${topic}! Grateful for everyone who supported this — looking forward to what’s next.`,
    }
  }
  return {
    title: null,
    content: `Sharing a quick update on ${topic}.\n\nWould love perspectives from this community — what’s working for you right now?`,
  }
}
