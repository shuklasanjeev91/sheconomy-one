import { describe, expect, it } from 'vitest'

import {
  buildPostDraftPrompt,
  composeExpansionChips,
  filterPostSuggestionChips,
  isComposeInstruction,
  isGenericFallbackDraft,
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

  it('detects the old generic template fallback', () => {
    expect(
      isGenericFallbackDraft(
        `Sharing a quick update on bioayurveda.

A few things stood out for me as I’ve been exploring this — especially how it connects to the work women-led teams are doing right now.

Would love perspectives from this community: what’s resonating for you, and what would you try next?`,
      ),
    ).toBe(true)
    expect(
      isGenericFallbackDraft(
        'BioAyurveda’s everyday rituals keep showing up in conversations with women founders who want wellness that fits a packed calendar.\n\nI’ve been looking at how clean, Ayurveda-inspired care can feel practical—not precious—for busy professionals.\n\nWhat’s one wellness habit you protect even on your busiest weeks?',
      ),
    ).toBe(false)
    expect(
      isThinOrEchoPostDraft(
        `Sharing a quick update on bioayurveda.

A few things stood out for me as I’ve been exploring this — especially how it connects to the work women-led teams are doing right now.

Would love perspectives from this community: what’s resonating for you, and what would you try next?`,
        'bioayurveda',
      ),
    ).toBe(true)
  })
})
