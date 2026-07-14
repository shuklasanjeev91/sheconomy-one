export type Icebreaker = {
  id: string
  label: string
  message: string
}

/** professional conversation starters for messaging someone from their profile. */
export function buildIcebreakers(options: {
  displayName: string
  headline?: string | null
  industry?: string | null
  creatorMode?: boolean
}): Icebreaker[] {
  const first = options.displayName.trim().split(/\s+/)[0] || 'there'
  const industry = options.industry?.trim()
  const headline = options.headline?.trim()

  const items: Icebreaker[] = [
    {
      id: 'hello',
      label: 'Say hello',
      message: `Hi ${first}, I'd love to connect and learn more about your work.`,
    },
    {
      id: 'interesting-work',
      label: 'Interesting work',
      message: headline
        ? `Hi ${first}, your work as ${headline} caught my eye — curious to hear what you're focused on right now.`
        : `Hi ${first}, your profile stood out — curious to hear what you're focused on right now.`,
    },
    {
      id: 'collaborate',
      label: 'Collaborate',
      message: industry
        ? `Hi ${first}, I'm exploring collaborations in ${industry}. Would you be open to a short chat?`
        : `Hi ${first}, I'm exploring a collaboration. Would you be open to a short chat?`,
    },
  ]

  if (options.creatorMode) {
    items.push({
      id: 'creator',
      label: 'Love your content',
      message: `Hi ${first}, I've been enjoying your posts — thanks for sharing what you create.`,
    })
  }

  return items
}
