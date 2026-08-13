import { supabase } from '~/lib/supabase'
import type { Json } from '~/lib/supabase/database.types'

import { GENDER_VERIFICATION } from '~/lib/gender-verification/constants'
import { isStaleGenderSessionError } from '~/lib/gender-verification/errors'

export type CompleteVerificationResult = {
  ok: boolean
  message: string
  verified?: boolean
}

export type CompleteVerificationInput = {
  sessionId: string
  detectedBlinks: number
  livenessScore: number
  genderDetected: boolean
  genderConfidence: number
  clientMetrics?: Json
}

type CompleteVerificationOutcome = {
  result: CompleteVerificationResult | null
  error: string | null
}

export async function createGenderVerificationSession(requiredBlinks = GENDER_VERIFICATION.requiredBlinks) {
  const { data, error } = await supabase.rpc('create_gender_verification_session', {
    p_required_blinks: requiredBlinks,
  })

  if (error) {
    return { sessionId: null as string | null, error: error.message }
  }

  return { sessionId: data as string, error: null as string | null }
}

export async function completeGenderVerificationSession(input: CompleteVerificationInput) {
  const { data, error } = await supabase.rpc('complete_gender_verification_session', {
    p_session_id: input.sessionId,
    p_detected_blinks: input.detectedBlinks,
    p_liveness_score: input.livenessScore,
    p_gender_detected: input.genderDetected,
    p_gender_confidence: input.genderConfidence,
    p_client_metrics: input.clientMetrics,
  })

  if (error) {
    return { result: null, error: error.message }
  }

  const payload = data as Record<string, unknown> | null
  // RPC returns `{ ok: true }` on success; keep legacy keys for older backends.
  const ok =
    payload?.ok === true || payload?.success === true || payload?.verified === true

  return {
    result: {
      ok,
      message: String(
        payload?.message ??
          payload?.error ??
          (ok ? 'Verification complete.' : 'Verification failed.'),
      ),
      verified: ok,
    } satisfies CompleteVerificationResult,
    error: null as string | null,
  }
}

function isStaleOutcome(outcome: CompleteVerificationOutcome): boolean {
  if (outcome.error) return isStaleGenderSessionError(outcome.error)
  if (outcome.result && !outcome.result.ok) return isStaleGenderSessionError(outcome.result.message)
  return false
}

/**
 * Submit the scores, retrying once on a fresh session when the server says ours
 * is stale. A parallel `start()` supersedes pending sessions, so a good read
 * used to surface as a failure the user could not act on.
 */
export async function submitGenderVerificationSession(
  input: CompleteVerificationInput,
): Promise<CompleteVerificationOutcome & { sessionId: string }> {
  const first = await completeGenderVerificationSession(input)
  if (!isStaleOutcome(first)) return { ...first, sessionId: input.sessionId }

  const { sessionId: freshSessionId, error: createError } = await createGenderVerificationSession()
  if (!freshSessionId) {
    return { result: first.result, error: createError ?? first.error, sessionId: input.sessionId }
  }

  const retried = await completeGenderVerificationSession({ ...input, sessionId: freshSessionId })
  return { ...retried, sessionId: freshSessionId }
}
