import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, usePathname } from 'one'

import { GenderDeniedModal } from '~/components/gender-verification/GenderDeniedModal'
import { GenderVerificationModal } from '~/components/gender-verification/GenderVerificationModal'
import { requiresGenderVerification } from '~/config/route-protection.config'
import { useProfile } from '~/hooks/useProfile'
import { GENDER_VERIFICATION_PROMPT } from '~/lib/gender-verification'
import { buildVerificationDeniedRedirect } from '~/lib/gender-verification/denied-redirect'
import { rememberSafeAppPath } from '~/lib/gender-verification/route-memory'
import {
  clearVerificationFlowOpen,
  markVerificationFlowOpen,
  peekVerificationFlowOpen,
  readVerificationFlowOpen,
} from '~/lib/gender-verification/verification-flow-storage'
import { replaceApp } from '~/lib/platform/navigate'
import { refreshProfiles } from '~/lib/profile/refresh'
import { patchCachedProfile } from '~/lib/profile/profile-cache'
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
 * App-wide verification UX host.
 *
 * - Protected routes are blocked in {@link AppAccessGate}; unverified members are
 *   redirected to their last safe route and see {@link GenderDeniedModal}.
 * - "Verify myself" opens {@link GenderVerificationModal}; flow state persists
 *   across redirect so the liveness check is not interrupted.
 */
export function GenderVerificationHost() {
  const { profile, isAuthenticated } = useProfile()
  const pathname = usePathname()
  const params = useLocalSearchParams()

  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [manualOpen, setManualOpen] = useState(() => peekVerificationFlowOpen())
  const [denied, setDenied] = useState(false)
  const [, forceTick] = useState(0)

  const closedOnPathRef = useRef<string | null>(null)
  const verificationFlowRef = useRef(peekVerificationFlowOpen())
  const didRedirectRef = useRef(false)

  const isVerified = profile?.is_verified === true
  const needsVerification = isAuthenticated && !!profile && !isVerified
  const onProtectedRoute = requiresGenderVerification(pathname)
  const suppressedRoute = isSuppressedRoute(pathname)
  const verificationFlowActive = manualOpen || verificationFlowRef.current

  useEffect(() => {
    rememberSafeAppPath(pathname)
  }, [pathname])

  // Restore verification modal after redirect / reload.
  useEffect(() => {
    if (!hydrated || !needsVerification) return
    let cancelled = false
    void readVerificationFlowOpen().then((open) => {
      if (cancelled || !open) return
      verificationFlowRef.current = true
      setManualOpen(true)
      setDenied(false)
    })
    return () => {
      cancelled = true
    }
  }, [hydrated, needsVerification])

  // Blocked on a protected route — show denied modal and redirect (once) to last safe page.
  useEffect(() => {
    if (!isAuthenticated || !profile || isVerified || !onProtectedRoute) return
    if (verificationFlowActive || peekVerificationFlowOpen()) return
    if (didRedirectRef.current) return

    setDenied(true)

    const redirect = buildVerificationDeniedRedirect()
    const redirectPath = (redirect.split('?')[0] ?? '/').replace(/\/$/, '') || '/'
    const currentPath = pathname.replace(/\/$/, '') || '/'
    if (currentPath === redirectPath) return

    didRedirectRef.current = true
    replaceApp(redirect)
  }, [isAuthenticated, profile, isVerified, onProtectedRoute, pathname, verificationFlowActive])

  useEffect(() => {
    if (!onProtectedRoute) {
      didRedirectRef.current = false
    }
  }, [onProtectedRoute])

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

  useEffect(() => {
    if (!isVerified) return
    verificationFlowRef.current = false
    void clearVerificationFlowOpen()
    setManualOpen(false)
    setDenied(false)
    setDismissedAt((current) => {
      if (current !== null) void persistStorage.removeItem(STORAGE_KEY)
      return null
    })
  }, [isVerified])

  useEffect(() => {
    if (verificationFlowActive || peekVerificationFlowOpen()) return

    const raw = params?.[RESTRICTED_PARAM]
    const flag = Array.isArray(raw) ? raw[0] : raw
    if (flag !== RESTRICTED_VALUE) return

    setDenied(true)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete(RESTRICTED_PARAM)
      window.history.replaceState({}, '', url.toString())
    }
  }, [params, verificationFlowActive])

  useEffect(() => {
    if (closedOnPathRef.current && closedOnPathRef.current !== pathname) {
      closedOnPathRef.current = null
    }
  }, [pathname])

  useEffect(() => {
    if (onProtectedRoute || !needsVerification || dismissedAt === null) return
    const remaining = COOLDOWN_MS - (Date.now() - dismissedAt)
    if (remaining <= 0) return
    const timer = setTimeout(() => forceTick((tick) => tick + 1), remaining + 50)
    return () => clearTimeout(timer)
  }, [needsVerification, dismissedAt, onProtectedRoute])

  const closeVerificationFlow = useCallback(() => {
    verificationFlowRef.current = false
    void clearVerificationFlowOpen()
    setManualOpen(false)
  }, [])

  const handleVerifyClose = useCallback(() => {
    const now = Date.now()
    setDismissedAt(now)
    void persistStorage.setItem(STORAGE_KEY, String(now))
    closedOnPathRef.current = pathname
    closeVerificationFlow()
  }, [closeVerificationFlow, pathname])

  const handleVerified = useCallback(() => {
    if (profile?.id) {
      void patchCachedProfile(profile.id, { is_verified: true }).then(() => refreshProfiles())
    } else {
      refreshProfiles()
    }
    closeVerificationFlow()
    setDenied(false)
  }, [closeVerificationFlow, profile?.id])

  const handleDeniedClose = useCallback(() => {
    const now = Date.now()
    setDismissedAt(now)
    void persistStorage.setItem(STORAGE_KEY, String(now))
    closedOnPathRef.current = pathname
    setDenied(false)
  }, [pathname])

  const handleDeniedVerify = useCallback(() => {
    verificationFlowRef.current = true
    void markVerificationFlowOpen()
    setDenied(false)
    setManualOpen(true)
    closedOnPathRef.current = null
  }, [])

  const cooledDown = dismissedAt === null || Date.now() - dismissedAt >= COOLDOWN_MS
  const autoShow =
    hydrated && needsVerification && !onProtectedRoute && cooledDown && !verificationFlowActive

  const showDenied =
    !verificationFlowActive &&
    (denied || (needsVerification && onProtectedRoute)) &&
    !suppressedRoute
  const showVerify =
    isAuthenticated &&
    profile?.is_verified !== true &&
    !suppressedRoute &&
    (verificationFlowActive || (needsVerification && !showDenied && autoShow))

  return (
    <>
      <GenderVerificationModal
        open={showVerify}
        dismissible
        onClose={handleVerifyClose}
        onVerified={handleVerified}
      />
      <GenderDeniedModal open={showDenied} onClose={handleDeniedClose} onVerify={handleDeniedVerify} />
    </>
  )
}
