import { supabase } from '~/lib/supabase'

import { GENDER_VERIFICATION } from '~/lib/gender-verification/constants'

export type CompleteVerificationResult = {
  ok: boolean
  message: string
  verified?: boolean
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

export async function completeGenderVerificationSession(input: {
  sessionId: string
  detectedBlinks: number
  livenessScore: number
  genderDetected: boolean
  genderConfidence: number
}) {
  const { data, error } = await supabase.rpc('complete_gender_verification_session', {
    p_session_id: input.sessionId,
    p_detected_blinks: input.detectedBlinks,
    p_liveness_score: input.livenessScore,
    p_gender_detected: input.genderDetected,
    p_gender_confidence: input.genderConfidence,
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
