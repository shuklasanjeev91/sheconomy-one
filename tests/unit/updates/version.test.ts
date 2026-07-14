import { describe, expect, it } from 'vitest'

import { compareVersions, isVersionLessThan, parseVersion } from '~/lib/updates/version'

describe('version helpers', () => {
  it('parses dotted versions', () => {
    expect(parseVersion('1.20.1')).toEqual([1, 20, 1])
    expect(parseVersion('2.0.0-beta')).toEqual([2, 0, 0])
  })

  it('compares versions', () => {
    expect(compareVersions('1.2.0', '1.2.1')).toBeLessThan(0)
    expect(compareVersions('1.3.0', '1.2.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('detects versions below minimum', () => {
    expect(isVersionLessThan('1.19.9', '1.20.0')).toBe(true)
    expect(isVersionLessThan('1.20.0', '1.20.0')).toBe(false)
  })
})
