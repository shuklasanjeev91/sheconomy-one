import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getChatTheme } from '~/chat/lib/chat-theme'
import { getCommunityUi } from '~/community/lib/community-theme'
import { BRAND_BLUE, REACTION_TYPES } from '~/community/lib/constants'
import { brandColors } from '~/config/brand-colors'
import { getCoWorkUi } from '~/co-work/lib/theme'
import { getAppUi } from '~/lib/theme/app-ui'

const FORBIDDEN_PRODUCT_ACCENTS = [
  '#0a66c2',
  '#004182',
  '#1877f2',
  '#e47911',
  '#25d366',
  '#1da1f2',
  '#229ed9',
  '#f58529',
  '#dd2a7b',
  '#8134af',
] as const

const THEME_SOURCE_FILES = [
  'community/lib/community-theme.ts',
  'community/lib/constants.ts',
  'community/navigation/config.ts',
  'community/components/StoriesStrip.tsx',
  'components/share/ShareSheet.tsx',
  'chat/lib/chat-theme.ts',
  'chat/components/CallOverlay.tsx',
  'chat/screens/ChatCallScreen.tsx',
  'co-work/lib/theme.ts',
  'lib/theme/app-ui.ts',
  'config/brand-colors.ts',
] as const

describe('SHEconomy brand colors', () => {
  it('locks light-mode brand accents to magenta primary', () => {
    expect(getAppUi('light').brand).toBe(brandColors.primary)
    expect(getCommunityUi('light').brand).toBe(brandColors.primary)
    expect(getChatTheme('light').brand).toBe(brandColors.primary)
    expect(getCoWorkUi('light').brand).toBe(brandColors.primary)
    expect(BRAND_BLUE).toBe(brandColors.primary)
    expect(REACTION_TYPES.find((r) => r.type === 'like')?.color).toBe(brandColors.primary)
  })

  it('uses brand primaryLight for dark-mode interactive accents where established', () => {
    expect(getAppUi('dark').brand).toBe(brandColors.primaryLight)
    expect(getCommunityUi('dark').brand).toBe(brandColors.primaryLight)
    expect(getChatTheme('dark').brand).toBe(brandColors.primaryLight)
  })

  it('keeps coral in the official brand palette', () => {
    expect(brandColors.coral).toBe('#F87840')
    expect(getAppUi('light').coral).toBe(brandColors.coral)
    expect(getCoWorkUi('light').coral).toBe(brandColors.coral)
  })

  it('forbids third-party product accents in brand UI modules', () => {
    for (const relativePath of THEME_SOURCE_FILES) {
      const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8').toLowerCase()
      for (const hex of FORBIDDEN_PRODUCT_ACCENTS) {
        expect(source, `${relativePath} must not contain ${hex}`).not.toContain(hex)
      }
    }
  })
})
