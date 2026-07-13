/** Cross-platform auth UI — unified OTP sign-in for web, iOS, and Android. */

export { AuthBrandLogo } from './AuthBrandLogo'
export { AuthOnboarding } from './AuthOnboarding'
export { AuthBenefitsCarousel } from './AuthBenefitsCarousel'
export { AuthShell } from './AuthShell'
export { AuthSignInFlow, SignInPanel } from './AuthSignInFlow'
export { AuthOtpForm } from './AuthOtpForm'
export { AuthMethodTabs, AuthStepProgress, type AuthMethod } from './AuthMethodTabs'
export { AuthAccountButton, AuthButton } from './AuthAccountButton'
export {
  AuthUserMenuContent,
  AuthGuestMenuContent,
} from './AuthAccountMenu'
export {
  getAccountMenuSections,
  getAccountQuickActions,
  getGuestAccountMenuSections,
} from './accountMenu'
export { AuthBackButton } from './AuthBackButton'
export { CountryCodePicker, DEFAULT_COUNTRY } from './CountryCodePicker'
export { AppAccessGate } from './AppAccessGate'
export { RequireAuth } from './RequireAuth'
export { RequireShopAccess } from './RequireShopAccess'
export { RouteGuard, RequireAdmin, RequireVendorRole, AccessDenied } from './RouteGuard'
export { AUTH_COPY } from './auth-copy'
export { useAuthLayout, AUTH_LAYOUT } from './auth-layout'
