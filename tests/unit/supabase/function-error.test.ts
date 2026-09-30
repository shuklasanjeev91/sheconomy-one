import { describe, expect, it } from 'vitest'

import { readSupabaseFunctionError } from '~/lib/supabase/function-error'

describe('readSupabaseFunctionError', () => {
  it('prefers data.error over the generic FunctionsHttpError message', async () => {
    const message = await readSupabaseFunctionError(
      new Error('Edge Function returned a non-2xx status code'),
      { error: 'Video meetings are not configured on the server.' },
      'fallback',
    )
    expect(message).toBe('Video meetings are not configured on the server.')
  })

  it('ignores the generic non-2xx message when no body is available', async () => {
    const message = await readSupabaseFunctionError(
      new Error('Edge Function returned a non-2xx status code'),
      null,
      'Could not join the video room.',
    )
    expect(message).toBe('Could not join the video room.')
  })

  it('keeps specific Error messages that are not non-2xx', async () => {
    const message = await readSupabaseFunctionError(
      new Error('Unauthorized'),
      null,
      'fallback',
    )
    expect(message).toBe('Unauthorized')
  })
})
