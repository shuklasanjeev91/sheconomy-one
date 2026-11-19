import { describe, expect, it } from 'vitest'

import {
  buildPostDraftPrompt,
  filterPostSuggestionChips,
  fallbackPostDraft,
  isThinOrEchoPostDraft,
} from '~/community/lib/post-compose-suggestions'

describe('post compose AI helpers', () => {
  it('treats short or echoed drafts as thin', () => {
    expect(isThinOrEchoPostDraft('Write about wef.org.in', 'Write about wef.org.in')).toBe(true)
    expect(isThinOrEchoPostDraft('Write about wef.org.in')).toBe(true)
    expect(
      isThinOrEchoPostDraft(
        'I’ve been following WEF updates and wanted to share a few takeaways with this community.\n\nWhat stood out for you?',
        'Write about wef.org.in',
      ),
    ).toBe(false)
  })

  it('filters suggestion chips that echo the composer seed', () => {
    const chips = filterPostSuggestionChips(
      [
        { label: 'Write about wef.org.in', draft: 'Write about wef.org.in' },
        {
          label: 'WEF takeaways',
          draft:
            'Sharing a few reflections from wef.org.in — the sessions on inclusive growth felt especially relevant for women-led businesses this year.',
        },
      ],
      'Write about wef.org.in',
    )
    expect(chips).toHaveLength(1)
    expect(chips[0]?.label).toBe('WEF takeaways')
  })

  it('builds an expansion prompt from notes and media', () => {
    const prompt = buildPostDraftPrompt({
      seed: 'Write about wef.org.in',
      photoCount: 2,
      videoCount: 1,
      link: { url: 'https://wef.org.in', title: 'WEF India' },
    })
    expect(prompt).toContain('complete, ready-to-publish')
    expect(prompt).toContain('Write about wef.org.in')
    expect(prompt).toContain('2 photo')
    expect(prompt).toContain('1 video')
    expect(prompt).toContain('https://wef.org.in')
  })

  it('strips “write about” instructions in the local fallback', () => {
    const draft = fallbackPostDraft('Write about wef.org.in', 'text')
    expect(draft.content.toLowerCase()).toContain('wef.org.in')
    expect(draft.content.toLowerCase()).not.toMatch(/^write about wef\.org\.in$/i)
    expect(draft.content.length).toBeGreaterThan(80)
  })
})
