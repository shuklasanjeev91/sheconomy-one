import { describe, expect, it } from 'vitest'

import {
  buildPostDraftPrompt,
  composeExpansionChips,
  filterPostSuggestionChips,
  fallbackPostDraft,
  isComposeInstruction,
  isLeakedComposePrompt,
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

  it('sends only the member topic to SHERPA (no system-instruction leak)', () => {
    const prompt = buildPostDraftPrompt({
      seed: 'About wef.org.in #missionmillion #womenlead',
      photoCount: 2,
      videoCount: 1,
      link: { url: 'https://wef.org.in', title: 'WEF India' },
    })
    expect(prompt).toBe('About wef.org.in #missionmillion #womenlead')
    expect(prompt).not.toMatch(/you are sherpa/i)
    expect(prompt).not.toMatch(/member notes/i)
  })

  it('detects leaked drafting instructions in model output', () => {
    expect(
      isLeakedComposePrompt(
        'You are SHERPA writing for SHEconomy Community (women-led professionals). Write a COMPLETE ready-to-publish post — not an outline and not a restatement of the instruction. Member notes / topic: About wef.org.in',
      ),
    ).toBe(true)
    expect(
      isLeakedComposePrompt(
        'Sharing a few reflections from wef.org.in — inclusive growth matters for women-led teams.',
      ),
    ).toBe(false)
  })

  it('strips “write about” instructions in the local fallback', () => {
    const draft = fallbackPostDraft('Write about wef.org.in', 'text')
    expect(draft.content.toLowerCase()).toContain('wef.org.in')
    expect(draft.content.toLowerCase()).not.toMatch(/^write about wef\.org\.in$/i)
    expect(draft.content.length).toBeGreaterThan(160)
    expect(draft.content.split('\n\n').length).toBeGreaterThanOrEqual(2)
  })
})
