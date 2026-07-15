import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, usePathname } from 'one'

import { GenderDeniedModal } from '~/components/gender-verification/GenderDeniedModal'
import { GenderVerificationModal } from '~/components/gender-verification/GenderVerificationModal'
import { requiresGenderVerification } from '~/config/route-protection.config'
import { useProfile } from '~/hooks/useProfile'
import { GENDER_VERIFICATION_PROMPT } from '~/lib/gender-verification'
import { refreshProfiles } from '~/lib/profile/refresh'
import { persistStorage } from '~/lib/store/storage'

const {
  dismissCooldownMs: COOLDOWN_MS,
  dismissStorageKey: STORAGE_KEY,
  restrictedQueryParam: RESTRICTED_PARAM,
  restrictedQueryValue: RESTRICTED_VALUE,
} = GENDER_VERIFICATION_PROMPT

/** Routes that own their own verification UI (or shouldn't be interrupted). */
function isSuppressedRoute(pathname: string): boolean {
  return pathname.startsWith('/auth') || pathname.startsWith('/ui-kit')
}

/**
 * App-wide gender-verification host. Mounted once near the shell root, it decides
 * when to surface the verification popup:
 *
 *  - Shows automatically when a signed-in member has `profiles.is_verified === false`.
 *  - After the member dismisses it, stays quiet for `dismissCooldownMs` (10 min)
 *    so we never nag on every screen.
 *  - Re-opens immediately (bypassing the cooldown) when the member navigates to a
 *    gender-restricted route (see `requiresGenderVerification`).
 *  - Opens the "access restricted" modal when a `?gender=restricted` flag is present.
 *
 * All timings/labels come from `GENDER_VERIFICATION_PROMPT` — nothing is hardcoded here.
 */
export function GenderVerificationHost() {
  const { profile, isAuthenticated } = useProfile()
  const pathname = usePathname()
  const params = useLocalSearchParams()

  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [denied, setDenied] = useState(false)
  const [, forceTick] = useState(0)

  // Path where the member last closed the modal — used to avoid re-opening on the
  // very same page while still re-prompting when they navigate elsewhere.
  const closedOnPathRef = useRef<string | null>(null)

  const isVerified = profile?.is_verified === true
  const needsVerification = isAuthenticated && !!profile && profile.is_verified === false
  const suppressedRoute = isSuppressedRoute(pathname)

  // Load the last dismissal timestamp once (client-only; keeps SSR output empty).
  useEffect(() => {
    let cancelled = false
    persistStorage
      .getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return
        const parsed = raw ? Number(raw) : NaN
        setDismissedAt(Number.isFinite(parsed) ? parsed : null)
        setHydrated(true)
      })
      .catch(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Once verified, clear any dismissal record so a future unverified state prompts fresh.
  useEffect(() => {
    if (!isVerified) return
    setManualOpen(false)
    setDenied(false)
    setDismissedAt((current) => {
      if (current !== null) void persistStorage.removeItem(STORAGE_KEY)
      return null
    })
  }, [isVerified])

  // `?gender=restricted` → surface the access-restricted modal, then clean the URL.
  useEffect(() => {
    const raw = params?.[RESTRICTED_PARAM]
    const flag = Array.isArray(raw) ? raw[0] : raw
    if (flag !== RESTRICTED_VALUE) return

    setDenied(true)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete(RESTRICTED_PARAM)
      window.history.replaceState({}, '', url.toString())
    }
  }, [params])

  // Clear the "closed here" marker after navigating away so protected routes re-prompt.
  useEffect(() => {
    if (closedOnPathRef.current && closedOnPathRef.current !== pathname) {
      closedOnPathRef.current = null
    }
  }, [pathname])

  // Re-evaluate exactly when the dismissal cooldown elapses (without needing navigation).
  useEffect(() => {
    if (!needsVerification || dismissedAt === null) return
    const remaining = COOLDOWN_MS - (Date.now() - dismissedAt)
    if (remaining <= 0) return
    const timer = setTimeout(() => forceTick((tick) => tick + 1), remaining + 50)
    return () => clearTimeout(timer)
  }, [needsVerification, dismissedAt])

  const handleVerifyClose = useCallback(() => {
    const now = Date.now()
    setDismissedAt(now)
    void persistStorage.setItem(STORAGE_KEY, String(now))
    closedOnPathRef.current = pathname
    setManualOpen(false)
  }, [pathname])

  const handleVerified = useCallback(() => {
    refreshProfiles()
    setManualOpen(false)
    setDenied(false)
  }, [])

  const handleDeniedClose = useCallback(() => {
    const now = Date.now()
    setDismissedAt(now)
    void persistStorage.setItem(STORAGE_KEY, String(now))
    closedOnPathRef.current = pathname
    setDenied(false)
  }, [pathname])

  const handleDeniedVerify = useCallback(() => {
    setDenied(false)
    setManualOpen(true)
    closedOnPathRef.current = null
  }, [])

  const forcedByRoute =
    requiresGenderVerification(pathname) && closedOnPathRef.current !== pathname
  const cooledDown = dismissedAt === null || Date.now() - dismissedAt >= COOLDOWN_MS
  const autoShow = hydrated && needsVerification && (forcedByRoute || cooledDown)

  const showDenied = denied && !suppressedRoute
  const showVerify =
    needsVerification && !suppressedRoute && !showDenied && (manualOpen || autoShow)

  return (
    <>
      <GenderVerificationModal
        open={showVerify}
        onClose={handleVerifyClose}
        onVerified={handleVerified}
      />
      <GenderDeniedModal open={showDenied} onClose={handleDeniedClose} onVerify={handleDeniedVerify} />
    </>
  )
}
