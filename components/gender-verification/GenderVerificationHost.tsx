import { useCallback, useEffect, useRef, useState } from 'react'
import type { Href } from 'one'
import { Platform } from 'react-native'
import { useLocalSearchParams, usePathname } from 'one'

import { GenderDeniedModal } from '~/components/gender-verification/GenderDeniedModal'
import { GenderVerificationModal } from '~/components/gender-verification/GenderVerificationModal'
import { requiresGenderVerification } from '~/config/route-protection.config'
import { useProfile } from '~/hooks/useProfile'
import { hasVerifiedFemaleAccess } from '~/lib/auth/access'
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
import { replaceApp } from '~/lib/platform/navigate'
import { refreshProfiles } from '~/lib/profile/refresh'
import { patchCachedProfile } from '~/lib/profile/profile-cache'
import { persistStorage } from '~/lib/store/storage'

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
 */
export function GenderVerificationHost() {
  const { profile, isAuthenticated } = useProfile()
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

  const hasFullAccess = hasVerifiedFemaleAccess(profile?.gender, profile?.is_verified)
  const needsVerification = isAuthenticated && !!profile && !hasFullAccess
  const onProtectedRoute = requiresGenderVerification(pathname)
  const onIntentRoute = isHumanVerificationIntentPath(pathname)
  const suppressedRoute = isSuppressedRoute(pathname)
  const verificationFlowActive = manualOpen || verificationFlowRef.current

  const openVerificationUi = useCallback(() => {
    if (hasFullAccessRef.current) {
      clearPendingHumanVerificationOpen()
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
    return subscribeHumanVerificationOpen(() => {
      if (hasFullAccessRef.current) {
        clearPendingHumanVerificationOpen()
        return
      }
      if (!isAuthenticatedRef.current) return
      openVerificationUi()
    })
  }, [openVerificationUi])

  useEffect(() => {
    if (!isAuthenticated || hasFullAccess) return
    if (
      verificationFlowRef.current ||
      peekVerificationFlowOpen() ||
      peekPendingHumanVerificationOpen()
    ) {
      openVerificationUi()
    }
  }, [isAuthenticated, hasFullAccess, openVerificationUi])

  useEffect(() => {
    if (!hydrated || !isAuthenticated || hasFullAccess) return
    let cancelled = false
    void readVerificationFlowOpen().then((open) => {
      if (cancelled || !open) return
      openVerificationUi()
    })
    return () => {
      cancelled = true
    }
  }, [hydrated, isAuthenticated, hasFullAccess, openVerificationUi])

  // Blocked on a protected / intent route — treat missing profile as limited.
  useEffect(() => {
    if (!isAuthenticated || hasFullAccess) return
    if (!onProtectedRoute && !onIntentRoute) return
    if (verificationFlowActive || peekVerificationFlowOpen()) return
    if (didRedirectRef.current) return

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
    isAuthenticated,
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
    if (!isAuthenticated || hasFullAccess || suppressedRoute) return
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
    isAuthenticated,
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
  }, [closeVerificationFlow, pathname])

  const handleVerified = useCallback(() => {
    if (profile?.id) {
      void patchCachedProfile(profile.id, { is_verified: true, gender: true }).then(() =>
        refreshProfiles(),
      )
    } else {
      refreshProfiles()
    }
    closeVerificationFlow()
    setDenied(false)

    void readVerificationReturnTo().then((returnTo) => {
      void clearVerificationReturnTo()
      if (returnTo) {
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
    isAuthenticated &&
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
