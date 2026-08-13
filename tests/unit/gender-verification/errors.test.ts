import { describe, expect, it } from 'vitest'

import {
  GENDER_ERROR_CODES,
  GENDER_ERROR_MESSAGES,
  classifyGenderError,
  isSoftRetryableGenderError,
  isStaleGenderSessionError,
  toFriendlyGenderError,
} from '~/lib/gender-verification/errors'

// The status check on gender_verification_sessions once rejected the 'verified'
// status the RPC writes, so every passing member saw the connection-problem copy
// because the constraint name contains the word "session".
const CONSTRAINT_VIOLATION =
  'new row for relation "gender_verification_sessions" violates check constraint "gender_verification_sessions_status_check"'

describe('server failures on the verification submit', () => {
  it('does not report a database fault as a session-start problem', () => {
    const code = classifyGenderError(new Error(CONSTRAINT_VIOLATION))

    expect(code).not.toBe(GENDER_ERROR_CODES.SESSION_FAILED)
    expect(code).toBe(GENDER_ERROR_CODES.UNKNOWN)
  })

  it('surfaces the database message verbatim so it can be diagnosed', () => {
    expect(toFriendlyGenderError(new Error(CONSTRAINT_VIOLATION))).toBe(CONSTRAINT_VIOLATION)
    expect(toFriendlyGenderError(new Error(CONSTRAINT_VIOLATION))).not.toBe(
      GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.SESSION_FAILED],
    )
  })

  it('does not read a missing function as a blocked camera', () => {
    const code = classifyGenderError(
      new Error(
        'Could not find the function public.complete_gender_verification_session in the schema cache',
      ),
    )

    expect(code).toBe(GENDER_ERROR_CODES.UNKNOWN)
  })
})

describe('stale verification sessions', () => {
  const staleMessages = [
    'Verification session is no longer active.',
    'Verification session not found.',
    'Verification session expired. Please try again.',
  ]

  it('classifies a superseded, missing, or expired session as stale', () => {
    for (const message of staleMessages) {
      expect(classifyGenderError(new Error(message))).toBe(GENDER_ERROR_CODES.SESSION_STALE)
      expect(isStaleGenderSessionError(message)).toBe(true)
    }
  })

  it('retries a stale session automatically, unlike a start failure', () => {
    expect(isSoftRetryableGenderError(staleMessages[0])).toBe(true)
    expect(isSoftRetryableGenderError(GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.NOT_ELIGIBLE])).toBe(
      false,
    )
  })

  it('leaves a genuine start failure on the connection copy', () => {
    expect(classifyGenderError(new Error('Could not start verification session.'))).toBe(
      GENDER_ERROR_CODES.SESSION_FAILED,
    )
    expect(
      classifyGenderError(new Error(GENDER_ERROR_MESSAGES[GENDER_ERROR_CODES.SESSION_FAILED])),
    ).toBe(GENDER_ERROR_CODES.SESSION_FAILED)
    expect(isStaleGenderSessionError('Could not start verification session.')).toBe(false)
  })
})
