import { useCallback, useEffect, useRef, useState } from 'react'
import type { Href } from 'one'
import { Platform } from 'react-native'
import { useLocalSearchParams, usePathname } from 'one'

import { GenderDeniedModal } from '~/components/gender-verification/GenderDeniedModal'
import { GenderVerificationModal } from '~/components/gender-verification/GenderVerificationModal'
import { requiresGenderVerification } from '~/config/route-protection.config'
import { useProfile } from '~/hooks/useProfile'
import { hasVerifiedFemaleAccess } from '~/lib/auth/access'
import { isSafeReturnPath } from '~/lib/auth/redirect'
import { GENDER_VERIFICATION_PROMPT } from '~/lib/gender-verification'
import { buildVerificationDeniedRedirect, isHumanVerificationIntentPath } from '~/lib/gender-verification/denied-redirect'
import { rememberSafeAppPath } from '~/lib/gender-verification/route-memory'
import {
  clearVerificationReturnTo,
  readVerificationReturnTo,
  rememberVerificationReturnTo,
} from '~/lib/gender-verification/return-to-storage'
import {
  clearVerificationFlowOpen,
  markVerificationFlowOpen,
  peekVerificationFlowOpen,
  readVerificationFlowOpen,
} from '~/lib/gender-verification/verification-flow-storage'
import {
  subscribeHumanVerificationOpen,
  clearPendingHumanVerificationOpen,
  peekPendingHumanVerificationOpen,
} from '~/lib/gender-verification/open-request'
import { navigateApp, replaceApp } from '~/lib/platform/navigate'
import { refreshProfiles } from '~/lib/profile/refresh'
import { patchSessionProfile } from '~/lib/profile/profile-store'
import { persistStorage } from '~/lib/store/storage'
import { commerceRoutes } from '~/lib/routes'

const {
  dismissStorageKey: STORAGE_KEY,
  restrictedQueryParam: RESTRICTED_PARAM,
  restrictedQueryValue: RESTRICTED_VALUE,
  verifyQueryParam: VERIFY_PARAM,
  verifyQueryValue: VERIFY_VALUE,
  returnToQueryParam: RETURN_TO_PARAM,
} = GENDER_VERIFICATION_PROMPT

/** Routes that own their own verification UI (or shouldn't be interrupted). */
function isSuppressedRoute(pathname: string): boolean {
  return pathname.startsWith('/ui-kit') || pathname.startsWith('/auth/verify-gender')
}

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = params?.[key]
  return Array.isArray(raw) ? raw[0] : raw
}

function stripQueryParams(keys: string[]) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return
  const url = new URL(window.location.href)
  let changed = false
  for (const key of keys) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  }
  if (changed) window.history.replaceState({}, '', url.toString())
}

/**
 * App-wide Human verification UX host.
 *
 * Full women-first access requires verified female (`gender === true` AND
 * `is_verified`). `is_verified` alone must NOT suppress the modal — phone OTP
 * / legacy rows can set that flag without female access.
 *
 * Never treat an unsettled profile as limited — that falsely bounced verified
 * vendors (e.g. My Shop) to `?gender=restricted` while the row was still loading.
 */
export function GenderVerificationHost() {
  const { profile, isAuthenticated, isLoading, isProfileConfirmed } = useProfile()
  const pathname = usePathname()
  const params = useLocalSearchParams()

  const [hydrated, setHydrated] = useState(false)
  const [manualOpen, setManualOpen] = useState(() => peekVerificationFlowOpen())
  const [denied, setDenied] = useState(false)

  const closedOnPathRef = useRef<string | null>(null)
  const verificationFlowRef = useRef(peekVerificationFlowOpen())
  const didRedirectRef = useRef(false)
  const isAuthenticatedRef = useRef(isAuthenticated)
  const hasFullAccessRef = useRef(hasVerifiedFemaleAccess(profile?.gender, profile?.is_verified))
  isAuthenticatedRef.current = isAuthenticated
  hasFullAccessRef.current = hasVerifiedFemaleAccess(profile?.gender, profile?.is_verified)

  // `isProfileConfirmed` keeps a warm-cache row from denying access: the store
  // settles synchronously from cache, and a row cached before verification would
  // otherwise redirect a full-access member to `?gender=restricted`.
  const profileReady = isAuthenticated && !isLoading && !!profile && isProfileConfirmed
  const hasFullAccess = hasVerifiedFemaleAccess(profile?.gender, profile?.is_verified)
  const needsVerification = profileReady && !hasFullAccess
  const onProtectedRoute = requiresGenderVerification(pathname)
  const onIntentRoute = isHumanVerificationIntentPath(pathname)
  const suppressedRoute = isSuppressedRoute(pathname)
  const verificationFlowActive = manualOpen || verificationFlowRef.current

  /**
   * `returnTo` is where the member was heading. When they already have full
   * access the request came from a gate reading a stale profile, so honour the
   * destination — dropping it silently would make the tab press do nothing.
   */
  const openVerificationUi = useCallback((returnTo?: string | null) => {
    clearPendingHumanVerificationOpen()

    if (hasFullAccessRef.current) {
      void clearVerificationFlowOpen()
      void clearVerificationReturnTo()
      if (isSafeReturnPath(returnTo)) navigateApp(returnTo as Href)
      return
    }

    verificationFlowRef.current = true
    void markVerificationFlowOpen()
    setDenied(false)
    setManualOpen(true)
  }, [])

  useEffect(() => {
    rememberSafeAppPath(pathname)
  }, [pathname])

  useEffect(() => {
    return subscribeHumanVerificationOpen((request) => {
      if (!isAuthenticatedRef.current) return
      openVerificationUi(request.returnTo)
    })
  }, [openVerificationUi])

  useEffect(() => {
    if (!profileReady || hasFullAccess) return
    if (
      verificationFlowRef.current ||
      peekVerificationFlowOpen() ||
      peekPendingHumanVerificationOpen()
    ) {
      openVerificationUi(peekPendingHumanVerificationOpen()?.returnTo)
    }
  }, [profileReady, hasFullAccess, openVerificationUi])

  useEffect(() => {
    if (!hydrated || !profileReady || hasFullAccess) return
    let cancelled = false
    void readVerificationFlowOpen().then((open) => {
      if (cancelled || !open) return
      openVerificationUi()
    })
    return () => {
      cancelled = true
    }
  }, [hydrated, profileReady, hasFullAccess, openVerificationUi])

  // Blocked on a protected / intent route — only after the profile row is known.
  useEffect(() => {
    if (!profileReady || hasFullAccess) return
    if (!onProtectedRoute && !onIntentRoute) return
    if (verificationFlowActive || peekVerificationFlowOpen()) return
    if (didRedirectRef.current) return
    // User just skipped/dismissed on this path — don't immediately reopen.
    if (closedOnPathRef.current === pathname) return

    if (onIntentRoute) {
      void rememberVerificationReturnTo(pathname)
      openVerificationUi()
    } else {
      setDenied(true)
    }

    const redirectHref = onIntentRoute
      ? (buildVerificationDeniedRedirect().split('?')[0] ?? '/')
      : buildVerificationDeniedRedirect()

    const redirectPath = (String(redirectHref).split('?')[0] ?? '/').replace(/\/$/, '') || '/'
    const currentPath = pathname.replace(/\/$/, '') || '/'
    if (currentPath === redirectPath) return

    didRedirectRef.current = true
    replaceApp(redirectHref as Href)
  }, [
    profileReady,
    hasFullAccess,
    onProtectedRoute,
    onIntentRoute,
    pathname,
    verificationFlowActive,
    openVerificationUi,
  ])

  useEffect(() => {
    if (!onProtectedRoute && !onIntentRoute) {
      didRedirectRef.current = false
    }
  }, [onProtectedRoute, onIntentRoute])

  useEffect(() => {
    let cancelled = false
    void persistStorage
      .getItem(STORAGE_KEY)
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hasFullAccess) return
    verificationFlowRef.current = false
    clearPendingHumanVerificationOpen()
    void clearVerificationFlowOpen()
    void clearVerificationReturnTo()
    setManualOpen(false)
    setDenied(false)
    void persistStorage.removeItem(STORAGE_KEY)
  }, [hasFullAccess])

  useEffect(() => {
    if (!profileReady || hasFullAccess || suppressedRoute) return
    if (verificationFlowActive || peekVerificationFlowOpen()) {
      if (readParam(params, VERIFY_PARAM) === VERIFY_VALUE) {
        stripQueryParams([VERIFY_PARAM, RETURN_TO_PARAM])
      }
      return
    }

    const flag = readParam(params, VERIFY_PARAM)
    if (flag !== VERIFY_VALUE) return

    const returnTo = readParam(params, RETURN_TO_PARAM)
    if (returnTo) {
      try {
        void rememberVerificationReturnTo(decodeURIComponent(returnTo))
      } catch {
        void rememberVerificationReturnTo(returnTo)
      }
    }

    openVerificationUi()
    stripQueryParams([VERIFY_PARAM, RETURN_TO_PARAM])
  }, [
    params,
    profileReady,
    hasFullAccess,
    suppressedRoute,
    verificationFlowActive,
    openVerificationUi,
  ])

  useEffect(() => {
    if (verificationFlowActive || peekVerificationFlowOpen()) return

    const flag = readParam(params, RESTRICTED_PARAM)
    if (flag !== RESTRICTED_VALUE) return

    setDenied(true)
    stripQueryParams([RESTRICTED_PARAM])
  }, [params, verificationFlowActive])

  useEffect(() => {
    if (closedOnPathRef.current && closedOnPathRef.current !== pathname) {
      closedOnPathRef.current = null
    }
  }, [pathname])

  const closeVerificationFlow = useCallback(() => {
    verificationFlowRef.current = false
    clearPendingHumanVerificationOpen()
    void clearVerificationFlowOpen()
    setManualOpen(false)
  }, [])

  const handleVerifyClose = useCallback(() => {
    void persistStorage.setItem(STORAGE_KEY, String(Date.now()))
    closedOnPathRef.current = pathname
    void clearVerificationReturnTo()
    closeVerificationFlow()

    // Leaving Community / Chat / Create store without verifying must land on a
    // safe surface — otherwise the intent gate reopens and Skip looks broken.
    if (isHumanVerificationIntentPath(pathname) || requiresGenderVerification(pathname)) {
      const safePath = (buildVerificationDeniedRedirect().split('?')[0] ??
        String(commerceRoutes.home)) as Href
      replaceApp(safePath)
    }
  }, [closeVerificationFlow, pathname])

  const handleVerified = useCallback(() => {
    // Apply the new access synchronously for every consumer — a tab press that
    // races the refetch must not be treated as unverified.
    if (profile?.id) {
      patchSessionProfile(profile.id, { is_verified: true, gender: true })
    } else {
      refreshProfiles()
    }
    closeVerificationFlow()
    setDenied(false)

    void readVerificationReturnTo().then((returnTo) => {
      void clearVerificationReturnTo()
      if (isSafeReturnPath(returnTo)) {
        replaceApp(returnTo as Href)
      }
    })
  }, [closeVerificationFlow, profile?.id])

  const handleDeniedClose = useCallback(() => {
    void persistStorage.setItem(STORAGE_KEY, String(Date.now()))
    closedOnPathRef.current = pathname
    setDenied(false)
  }, [pathname])

  const handleDeniedVerify = useCallback(() => {
    closedOnPathRef.current = null
    openVerificationUi()
  }, [openVerificationUi])

  const showDenied =
    !verificationFlowActive &&
    (denied || (needsVerification && onProtectedRoute && !onIntentRoute)) &&
    !suppressedRoute

  const showVerify =
    profileReady &&
    !hasFullAccess &&
    !suppressedRoute &&
    (manualOpen || verificationFlowRef.current)

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
