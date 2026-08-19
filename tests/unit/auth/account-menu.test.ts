import { describe, expect, it, vi } from 'vitest'

vi.mock('~/components/ui', () => {
  const Icon = () => null
  return {
    Icons: new Proxy({}, { get: () => Icon }),
  }
})

const { getAccountMenuSections, getAccountQuickActions } = await import(
  '~/components/auth/accountMenu'
)

type Item = { id: string; href: unknown }

function allItems(over: { tier: 'male' | 'female'; isTierKnown: boolean }): Item[] {
  const sections = getAccountMenuSections({ ...over, hasShops: false })
  const quick = getAccountQuickActions({ ...over })
  return [...sections.flatMap((section) => section.items), ...quick]
}

function hrefOf(items: Item[], id: string): string {
  const found = items.find((item) => item.id === id)
  if (!found) throw new Error(`No account menu item "${id}"`)
  return String(found.href)
}

describe('account menu destinations', () => {
  it('never points anywhere at the restricted modal while the tier is unknown', () => {
    // An unsettled profile resolves to the limited tier. Baking that into the
    // menu is what sent verified members to `/?gender=restricted` the moment
    // they tapped Settings or Your profile.
    const items = allItems({ tier: 'male', isTierKnown: false })

    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(String(item.href)).not.toMatch(/gender=restricted/)
    }
  })

  it('keeps real account destinations while the tier is unknown', () => {
    const items = allItems({ tier: 'male', isTierKnown: false })

    expect(hrefOf(items, 'settings')).toBe('/settings')
    expect(hrefOf(items, 'profile')).toBe('/profile')
  })

  it('still gates account destinations once the member is known to be limited', () => {
    const items = allItems({ tier: 'male', isTierKnown: true })

    expect(hrefOf(items, 'settings')).toMatch(/gender=restricted/)
    expect(hrefOf(items, 'profile')).toMatch(/gender=restricted/)
  })

  it('leaves every destination intact for a verified female', () => {
    const items = allItems({ tier: 'female', isTierKnown: true })

    for (const item of items) {
      expect(String(item.href)).not.toMatch(/gender=restricted/)
      expect(String(item.href)).not.toMatch(/human=verify/)
    }
  })

  it('never gates Help or the assistant — both are public surfaces', () => {
    for (const isTierKnown of [false, true]) {
      const items = allItems({ tier: 'male', isTierKnown })
      expect(hrefOf(items, 'help')).not.toMatch(/gender=restricted/)
      expect(hrefOf(items, 'ai-assist')).not.toMatch(/gender=restricted/)
    }
  })
})
