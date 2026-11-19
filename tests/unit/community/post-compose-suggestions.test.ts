import { describe, expect, it } from 'vitest'

import {
  buildPostDraftPrompt,
  composeExpansionChips,
  filterPostSuggestionChips,
  fallbackPostDraft,
  isComposeInstruction,
  isThinOrEchoPostDraft,
} from '~/community/lib/post-compose-suggestions'

describe('post compose AI helpers', () => {
  it('detects short write-instructions', () => {
    expect(isComposeInstruction('Write about wef.org.in #sheconomy')).toBe(true)
    expect(
      isComposeInstruction(
        'I’ve been following WEF updates and wanted to share a few takeaways with this community.\n\nWhat stood out for you this week?',
      ),
    ).toBe(false)
  })

  it('treats short or echoed drafts as thin', () => {
    expect(isThinOrEchoPostDraft('Write about wef.org.in', 'Write about wef.org.in')).toBe(true)
    expect(isThinOrEchoPostDraft('Write about wef.org.in')).toBe(true)
    expect(
      isThinOrEchoPostDraft(
        'I’ve been following WEF updates and wanted to share a few takeaways with this community.\n\nThe sessions on inclusive growth felt especially relevant for women-led businesses. What stood out for you?',
        'Write about wef.org.in',
      ),
    ).toBe(false)
  })

  it('filters suggestion chips that echo the composer seed', () => {
    const chips = filterPostSuggestionChips(
      [
        { label: 'Write about wef.org.in #sheconomy', draft: 'Write about wef.org.in #sheconomy' },
        {
          label: 'WEF takeaways',
          draft:
            'Sharing a few reflections from wef.org.in — the sessions on inclusive growth felt especially relevant for women-led businesses this year.',
        },
      ],
      'Write about wef.org.in #sheconomy #internationalwomenday',
    )
    expect(chips).toHaveLength(1)
    expect(chips[0]?.label).toBe('WEF takeaways')
  })

  it('builds expansion action chips for instruction seeds', () => {
    const chips = composeExpansionChips('Write about wef.org.in')
    expect(chips.map((chip) => chip.label)).toEqual([
      'Expand into a post',
      'Make it professional',
      'Add a call to action',
    ])
  })

  it('builds an expansion prompt from notes and media', () => {
    const prompt = buildPostDraftPrompt({
      seed: 'Write about wef.org.in',
      photoCount: 2,
      videoCount: 1,
      link: { url: 'https://wef.org.in', title: 'WEF India' },
    })
    expect(prompt).toContain('COMPLETE ready-to-publish')
    expect(prompt).toContain('Write about wef.org.in')
    expect(prompt).toContain('2 photo')
    expect(prompt).toContain('1 video')
    expect(prompt).toContain('https://wef.org.in')
  })

  it('strips “write about” instructions in the local fallback', () => {
    const draft = fallbackPostDraft('Write about wef.org.in', 'text')
    expect(draft.content.toLowerCase()).toContain('wef.org.in')
    expect(draft.content.toLowerCase()).not.toMatch(/^write about wef\.org\.in$/i)
    expect(draft.content.length).toBeGreaterThan(160)
    expect(draft.content.split('\n\n').length).toBeGreaterThanOrEqual(2)
  })
})
