import type { ReactNode } from 'react'
import type { Href } from 'one'
import { Redirect, useRouter } from 'one'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { PageCenter } from '~/components/layout'
import { Button, Icons, Spinner, Text, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useRouteProtection } from '~/hooks/useRouteProtection'
import { useAppUi } from '~/lib/theme/useAppUi'
import { USER_ROLES, type UserRole } from '~/lib/profile/profile.type'

type RouteGuardProps = {
  children: ReactNode
  /**
   * Explicit roles allowed here. Omit to protect purely by the central route
   * config (`config/route-protection.config.ts`) for the current path.
   */
  allowedRoles?: readonly UserRole[]
  /** Require female (gender-verified) access. */
  requireGenderVerification?: boolean
  /** Require identity verification (`is_verified`). */
  requireVerification?: boolean
  /**
   * When a signed-in user lacks the role, redirect to their home instead of
   * showing the "access denied" screen. Defaults to `false` (show the screen —
   * clearer for the user).
   */
  redirectOnDeny?: boolean
  /** Where guests land after signing in. Defaults to the current route. */
  signInReturnTo?: string
}

/**
 * Declarative route protection. Wrap a screen or a section layout:
 *
 * ```tsx
 * <RouteGuard allowedRoles={[USER_ROLES.ADMIN]}>
 *   <AdminDashboard />
 * </RouteGuard>
 * ```
 *
 * It shows a spinner while auth loads, inline sign-in for guests, redirects for
 * gender/verification gates, and a friendly "access denied" screen when a
 * signed-in user's role is insufficient. All decisions come from the shared
 * `resolveRouteAccess` engine, so behaviour matches `useRouteProtection`.
 */
export function RouteGuard({
  children,
  allowedRoles,
  requireGenderVerification,
  requireVerification,
  redirectOnDeny = false,
  signInReturnTo,
}: RouteGuardProps) {
  const protection = useRouteProtection(allowedRoles, {
    requireGenderVerification,
    requireVerification,
  })

  if (protection.isChecking || !protection.decision) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  const { decision } = protection

  if (decision.status === 'allow') {
    return <>{children}</>
  }

  if (decision.status === 'signin') {
    return <AuthSignInFlow returnTo={signInReturnTo ?? decision.returnTo} />
  }

  if (decision.status === 'redirect') {
    return <Redirect href={decision.href} />
  }

  // decision.status === 'denied'
  if (redirectOnDeny) {
    return <Redirect href={decision.href} />
  }

  return <AccessDenied message={decision.message} homeHref={decision.href} />
}

/** Admin-only guard. */
export function RequireAdmin({ children, ...rest }: Omit<RouteGuardProps, 'allowedRoles'>) {
  return (
    <RouteGuard allowedRoles={[USER_ROLES.ADMIN]} {...rest}>
      {children}
    </RouteGuard>
  )
}

/** Vendor console guard — admins + vendors, women-first by default. */
export function RequireVendorRole({
  children,
  requireGenderVerification = true,
  ...rest
}: Omit<RouteGuardProps, 'allowedRoles'>) {
  return (
    <RouteGuard
      allowedRoles={[USER_ROLES.ADMIN, USER_ROLES.VENDOR]}
      requireGenderVerification={requireGenderVerification}
      {...rest}
    >
      {children}
    </RouteGuard>
  )
}

type AccessDeniedProps = {
  message: string
  homeHref: Href
}

/** Friendly, on-brand "you can't view this" screen with clear next actions. */
export function AccessDenied({ message, homeHref }: AccessDeniedProps) {
  const ui = useAppUi()
  const router = useRouter()

  return (
    <PageCenter>
      <YStack gap="$4" alignItems="center" maxWidth={420} paddingHorizontal="$4">
        <YStack
          width={72}
          height={72}
          borderRadius={999}
          backgroundColor={ui.roseSurface}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Lock size={32} color={ui.brand} />
        </YStack>

        <YStack gap="$2" alignItems="center">
          <Text fontSize={20} fontWeight="800" color={ui.text} textAlign="center" letterSpacing={-0.3}>
            Access denied
          </Text>
          <Text fontSize={14} color={ui.textSecondary} textAlign="center" lineHeight={20}>
            {message}
          </Text>
        </YStack>

        <YStack gap="$2.5" width="100%" maxWidth={280}>
          <Button
            borderRadius={radius.pill}
            backgroundColor={ui.brand}
            color={ui.onBrand}
            onPress={() => router.replace(homeHref)}
          >
            Go to home
          </Button>
          <Button
            chromeless
            borderRadius={radius.pill}
            color={ui.textSecondary}
            onPress={() => router.back()}
          >
            Go back
          </Button>
        </YStack>
      </YStack>
    </PageCenter>
  )
}
