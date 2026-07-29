/** Cross-platform auth UI — unified OTP sign-in for web, iOS, and Android. */

export { AuthBrandLogo } from '~/components/auth/AuthBrandLogo'
export { AuthOnboarding } from '~/components/auth/AuthOnboarding'
export { AuthBenefitsCarousel } from '~/components/auth/AuthBenefitsCarousel'
export { AuthShell } from '~/components/auth/AuthShell'
export { AuthSignInFlow, SignInPanel } from '~/components/auth/AuthSignInFlow'
export { AuthOtpForm } from '~/components/auth/AuthOtpForm'
export { AuthMethodTabs, AuthStepProgress, type AuthMethod } from '~/components/auth/AuthMethodTabs'
export { AuthAccountButton, AuthButton } from '~/components/auth/AuthAccountButton'
export {
  AuthUserMenuContent,
  AuthGuestMenuContent,
} from '~/components/auth/AuthAccountMenu'
export {
  getAccountMenuSections,
  getAccountQuickActions,
  getGuestAccountMenuSections,
} from '~/components/auth/accountMenu'
export { AuthBackButton } from '~/components/auth/AuthBackButton'
export { CountryCodePicker, DEFAULT_COUNTRY } from '~/components/auth/CountryCodePicker'
export { AppAccessGate } from '~/components/auth/AppAccessGate'
export { RequireAuth } from '~/components/auth/RequireAuth'
export { RequireShopAccess } from '~/components/auth/RequireShopAccess'
export { RouteGuard, RequireAdmin, RequireVendorRole, AccessDenied } from '~/components/auth/RouteGuard'
export { AUTH_COPY } from '~/components/auth/auth-copy'
export { useAuthLayout, AUTH_LAYOUT } from '~/components/auth/auth-layout'
