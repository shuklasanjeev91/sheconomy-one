/** Parse `1.2.3` / `1.2.3-beta` into numeric segments for comparison. */
export function parseVersion(version: string): number[] {
  const core = version.trim().split(/[-+]/)[0] ?? '0'
  return core.split('.').map((part) => {
    const n = Number.parseInt(part.replace(/[^\d]/g, ''), 10)
    return Number.isFinite(n) ? n : 0
  })
}

/** Returns negative if a < b, 0 if equal, positive if a > b. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  const len = Math.max(left.length, right.length)
  for (let i = 0; i < len; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function isVersionLessThan(current: string, minimum: string): boolean {
  return compareVersions(current, minimum) < 0
}
