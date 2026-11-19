import { describe, expect, it } from 'vitest'

import {
  deriveGifQueryFromSeed,
  extractTopicFromComposeNotes,
  mergeMemberHashtags,
} from '~/community/lib/post-draft-complete'

describe('post draft complete helpers', () => {
  it('preserves member hashtags the model dropped', () => {
    const merged = mergeMemberHashtags(
      'BioAyurveda rituals keep me grounded between meetings.\n\nWhat habit do you protect?\n\n#wellness',
      'Write about bioayurveda #youarestrongerthanyouthink #',
    )
    expect(merged.toLowerCase()).toContain('#youarestrongerthanyouthink')
    expect(merged.toLowerCase()).toContain('#wellness')
  })

  it('does not duplicate hashtags already in the draft', () => {
    const merged = mergeMemberHashtags(
      'Celebrating small wins.\n\n#youarestrongerthanyouthink',
      'Write about bioayurveda #youarestrongerthanyouthink',
    )
    expect(merged.match(/#youarestrongerthanyouthink/gi)?.length).toBe(1)
  })

  it('extracts the research topic from write-about seeds', () => {
    expect(extractTopicFromComposeNotes('Write about bioayurveda #youarestrongerthanyouthink')).toBe(
      'bioayurveda',
    )
    expect(extractTopicFromComposeNotes('About wef.org.in #missionmillion')).toBe('wef.org.in')
  })

  it('derives a short gif query from write-about seeds', () => {
    expect(deriveGifQueryFromSeed('Write about bioayurveda #youarestrongerthanyouthink')).toBe(
      'bioayurveda',
    )
    expect(deriveGifQueryFromSeed('')).toBe('women empowerment')
  })
})
