/**
 * Instant, on-device professional compose starters.
 * Works offline on web, iOS, and Android; AI can refine via `post_draft`.
 */

import { isGenericFallbackDraft } from '~/lib/ai/post-draft-guards'

export { isGenericFallbackDraft } from '~/lib/ai/post-draft-guards'

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

/**
 * True when model output leaked our drafting instructions into the post body.
 * (SHERPA sometimes echoes the user/system prompt instead of writing a post.)
 */
export function isLeakedComposePrompt(draft: string | null | undefined): boolean {
  const body = draft?.trim() ?? ''
  if (!body) return false
  return (
    /you are sherpa writing/i.test(body) ||
    /complete ready-to-publish post/i.test(body) ||
    /member notes\s*\/\s*topic:/i.test(body) ||
    /not an outline and not a restatement/i.test(body) ||
    /about 280–700 characters/i.test(body) ||
    /no markdown fences/i.test(body)
  )
}

/** True when a suggestion/draft is only a short instruction or repeats the seed. */
export function isThinOrEchoPostDraft(draft: string, seed?: string | null): boolean {
  const body = draft.trim()
  if (!body) return true
  if (isLeakedComposePrompt(body)) return true
  if (isGenericFallbackDraft(body)) return true
  if (body.length < 80) return true
  if (
    /^(write|create|make|draft|compose|generate|post about|tell|share about|help me|about)\b/i.test(
      body,
    )
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
 * Member-facing topic only — never include SHERPA system instructions here.
 * Instructions belong in API context / server system prompt so they cannot leak into the composer.
 */
export function buildPostDraftPrompt(input: {
  seed?: string | null
  photoCount?: number
  videoCount?: number
  link?: { url: string; title?: string | null; description?: string | null } | null
}): string {
  const seed = input.seed?.trim() ?? ''
  if (seed) return seed

  const parts: string[] = []
  const photos = input.photoCount ?? 0
  if (photos > 0) {
    parts.push(`Share a community post about the ${photos} attached photo${photos === 1 ? '' : 's'}.`)
  }
  const videos = input.videoCount ?? 0
  if (videos > 0) {
    parts.push(`Share a community post about the attached video${videos === 1 ? '' : 's'}.`)
  }
  const link = input.link
  if (link?.url) {
    parts.push(
      `Share a community post about this link: ${link.url}${link.title ? ` (${link.title})` : ''}`,
    )
  }
  return parts.join(' ') || 'Share a warm professional community update.'
}

/** Drop suggestion chips that merely echo the composer seed. */
export function filterPostSuggestionChips<T extends { label: string; draft: string }>(
  chips: T[],
  seed?: string | null,
): T[] {
  const normalizedSeed = normalizeComposeText(seed ?? '')
  return chips.filter((chip) => {
    if (isLeakedComposePrompt(chip.label) || isLeakedComposePrompt(chip.draft)) return false
    if (isGenericFallbackDraft(chip.draft)) return false
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
    .replace(/^rewrite this as a polished professional post:\s*/i, '')
    .replace(/^turn this into a post with a clear call to action:\s*/i, '')
    .trim()
  const topic = cleaned.slice(0, 120) || 'this week’s update'
  if (mode === 'article') {
    return {
      title: `Notes on ${topic}`,
      content: `I’ve been thinking about ${topic}.\n\nHere’s the short version of what I’m learning, what I’d do differently next time, and one question for this community.\n\nWhat would you add from your experience?`,
    }
  }
  if (mode === 'celebration') {
    return {
      title: null,
      content: `Excited to celebrate ${topic}!\n\nGrateful for everyone who supported this journey — the encouragement from this community made a real difference.\n\nHere’s to what’s next. Who else is celebrating a win this week?`,
    }
  }
  return {
    title: null,
    content: `Sharing a quick update on ${topic}.\n\nA few things stood out for me as I’ve been exploring this — especially how it connects to the work women-led teams are doing right now.\n\nWould love perspectives from this community: what’s resonating for you, and what would you try next?`,
  }
}
