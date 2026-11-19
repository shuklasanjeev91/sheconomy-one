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

function normalizeComposeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** True when composer text is a writing instruction / topic note, not a finished post. */
export function isComposeInstruction(text: string | null | undefined): boolean {
  const value = text?.trim() ?? ''
  if (!value) return false
  if (
    /^(write|create|make|draft|compose|generate|post about|tell|share about|help me)\b/i.test(value)
  ) {
    return true
  }
  // Short unfinished notes should expand; finished posts are usually longer.
  return value.length < 80
}

/** True when a suggestion/draft is only a short instruction or repeats the seed. */
export function isThinOrEchoPostDraft(draft: string, seed?: string | null): boolean {
  const body = draft.trim()
  if (!body) return true
  if (body.length < 80) return true
  if (
    /^(write|create|make|draft|compose|generate|post about|tell|share about|help me)\b/i.test(body)
  ) {
    return true
  }

  const seedText = (seed ?? '').trim()
  if (!seedText) return false

  const normalizedBody = normalizeComposeText(body)
  const normalizedSeed = normalizeComposeText(seedText)
  if (!normalizedSeed) return false
  if (normalizedBody === normalizedSeed) return true
  if (normalizedBody.startsWith(normalizedSeed) && body.length < seedText.length + 60) return true
  if (normalizedSeed.startsWith(normalizedBody)) return true
  // Near-echo: chip kept most of the seed and only trimmed a hashtag/tail.
  if (
    normalizedBody.length >= 12 &&
    (normalizedSeed.includes(normalizedBody) || normalizedBody.includes(normalizedSeed)) &&
    Math.abs(normalizedBody.length - normalizedSeed.length) < 40
  ) {
    return true
  }
  return false
}

/**
 * Build the SHERPA prompt so compose expands notes/media into a publishable post
 * instead of echoing the instruction.
 */
export function buildPostDraftPrompt(input: {
  seed?: string | null
  photoCount?: number
  videoCount?: number
  link?: { url: string; title?: string | null; description?: string | null } | null
}): string {
  const parts: string[] = [
    'Write a complete, ready-to-publish community post.',
    'Expand the member’s notes into warm, specific copy. Do not repeat their instruction verbatim.',
    'At most 2 hashtags. No markdown fences.',
  ]

  const seed = input.seed?.trim() ?? ''
  if (seed) parts.push(`Member notes / topic:\n${seed}`)

  const photos = input.photoCount ?? 0
  if (photos > 0) {
    parts.push(
      `They attached ${photos} photo${photos === 1 ? '' : 's'}. Mention the photo${photos === 1 ? '' : 's'} naturally as something they are sharing.`,
    )
  }

  const videos = input.videoCount ?? 0
  if (videos > 0) {
    parts.push(
      `They attached ${videos} video${videos === 1 ? '' : 's'}. Reference the video naturally without inventing a transcript.`,
    )
  }

  const link = input.link
  if (link?.url) {
    const title = link.title?.trim()
    const description = link.description?.trim()
    parts.push(
      [
        `They are sharing this link: ${link.url}`,
        title ? `Link title: ${title}` : null,
        description ? `Link summary: ${description.slice(0, 280)}` : null,
        'Weave the link into the post as the main subject.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  return parts.join('\n\n')
}

/** Drop suggestion chips that merely echo the composer seed. */
export function filterPostSuggestionChips<T extends { label: string; draft: string }>(
  chips: T[],
  seed?: string | null,
): T[] {
  const normalizedSeed = normalizeComposeText(seed ?? '')
  return chips.filter((chip) => {
    const label = normalizeComposeText(chip.label)
    if (normalizedSeed && label) {
      if (label === normalizedSeed) return false
      if (normalizedSeed.startsWith(label) && label.length >= 12) return false
      if (label.startsWith(normalizedSeed) && normalizedSeed.length >= 12) return false
      if (
        (normalizedSeed.includes(label) || label.includes(normalizedSeed)) &&
        Math.abs(label.length - normalizedSeed.length) < 40
      ) {
        return false
      }
    }
    if (isComposeInstruction(chip.label) && isThinOrEchoPostDraft(chip.draft, seed)) return false
    if (isThinOrEchoPostDraft(chip.draft, seed)) return false
    return true
  })
}

/** Action chips shown while the composer still holds an instruction / short note. */
export function composeExpansionChips(seed: string): Array<{ label: string; seed: string }> {
  const topic = seed.trim()
  if (!topic) return []
  return [
    { label: 'Expand into a post', seed: topic },
    { label: 'Make it professional', seed: `Rewrite this as a polished professional post:\n${topic}` },
    { label: 'Add a call to action', seed: `Turn this into a post with a clear call to action:\n${topic}` },
  ]
}

/** Fallback draft when the AI edge action is unavailable. */
export function fallbackPostDraft(prompt: string, mode: ComposeModeHint = 'text'): {
  title: string | null
  content: string
} {
  const cleaned = prompt
    .replace(/^write (a |an |the )?(post |update )?(about|on|regarding)\s+/i, '')
    .replace(/^write about\s+/i, '')
    .trim()
  const topic = cleaned.slice(0, 120) || 'this week’s update'
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
