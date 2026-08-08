import { GENDER_VERIFICATION_PROMPT } from '~/lib/gender-verification/constants'
import { rememberVerificationReturnTo } from '~/lib/gender-verification/return-to-storage'
import { markVerificationFlowOpen } from '~/lib/gender-verification/verification-flow-storage'

type HumanVerificationRequest = {
  returnTo?: string | null
}

type Listener = (request: HumanVerificationRequest) => void

const listeners = new Set<Listener>()

/** Last open request — replayed to late subscribers (Host mount after nav tap). */
let pendingRequest: HumanVerificationRequest | null = null

/**
 * Imperatively open Human verification (modal) for signed-in limited members.
 * Survives same-route taps on native where `?human=verify` would be a no-op.
 */
export function openHumanVerification(request: HumanVerificationRequest = {}): void {
  const returnTo = request.returnTo?.trim() || null
  pendingRequest = { returnTo }
  void markVerificationFlowOpen()
  if (returnTo) {
    void rememberVerificationReturnTo(returnTo)
  }
  for (const listener of listeners) {
    try {
      listener({ returnTo })
    } catch {
      // ignore subscriber errors
    }
  }
}

export function peekPendingHumanVerificationOpen(): HumanVerificationRequest | null {
  return pendingRequest
}

export function clearPendingHumanVerificationOpen(): void {
  pendingRequest = null
}

export function subscribeHumanVerificationOpen(listener: Listener): () => void {
  listeners.add(listener)
  // Replay so a Host that mounts after the tap still opens the modal.
  if (pendingRequest) {
    try {
      listener(pendingRequest)
    } catch {
      // ignore
    }
  }
  return () => {
    listeners.delete(listener)
  }
}

const { verifyQueryParam, verifyQueryValue, returnToQueryParam } = GENDER_VERIFICATION_PROMPT

/**
 * If `href` is a Human verification open redirect (`?human=verify`), fire the
 * modal request and return a cleaned navigation target (path without verify flags).
 * Returns `null` when the href is unrelated.
 */
export function consumeHumanVerificationHref(href: string): {
  cleanedHref: string
  returnTo: string | null
} | null {
  const raw = href.trim()
  if (!raw || !raw.includes(`${verifyQueryParam}=`)) return null

  const qIndex = raw.indexOf('?')
  if (qIndex < 0) return null

  const path = raw.slice(0, qIndex) || '/'
  const query = raw.slice(qIndex + 1)
  const params = new URLSearchParams(query)
  if (params.get(verifyQueryParam) !== verifyQueryValue) return null

  const returnToRaw = params.get(returnToQueryParam)
  let returnTo: string | null = null
  if (returnToRaw) {
    try {
      returnTo = decodeURIComponent(returnToRaw)
    } catch {
      returnTo = returnToRaw
    }
  }

  params.delete(verifyQueryParam)
  params.delete(returnToQueryParam)
  const rest = params.toString()
  const cleanedHref = rest ? `${path}?${rest}` : path

  openHumanVerification({ returnTo })
  return { cleanedHref, returnTo }
}
