import { describe, expect, it } from 'vitest'

import { createAsyncActionLock } from '~/lib/async/async-action-lock'

describe('async action lock', () => {
  it('prevents overlapping runs', async () => {
    const lock = createAsyncActionLock()
    let started = 0
    let finished = 0

    const slow = () =>
      lock.run(async () => {
        started += 1
        await new Promise((resolve) => setTimeout(resolve, 40))
        finished += 1
        return 'ok'
      })

    const first = slow()
    const second = slow()

    await expect(second).resolves.toBeUndefined()
    await expect(first).resolves.toBe('ok')
    expect(started).toBe(1)
    expect(finished).toBe(1)
    expect(lock.pending).toBe(false)
  })

  it('allows a second run after the first settles', async () => {
    const lock = createAsyncActionLock()
    await lock.run(async () => 1)
    await expect(lock.run(async () => 2)).resolves.toBe(2)
  })
})
