import { useLocalSearchParams } from 'one'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { PageCenter } from '~/components/layout'
import { Spinner } from '~/components/ui'
import { useAuth } from '~/hooks/useAuth'
import { useAccess } from '~/hooks/useAccess'
import {
  AUTH_RETURN_TO_PARAM,
  getReturnToFromLocation,
  normalizeReturnPath,
} from '~/lib/auth/redirect'

import { useAppUi } from '~/lib/theme/useAppUi'

function useSignInReturnTo(): string {
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>()
  const raw = params[AUTH_RETURN_TO_PARAM]
  const fromParams = Array.isArray(raw) ? raw[0] : raw
  if (fromParams) return normalizeReturnPath(fromParams)
  return normalizeReturnPath(String(getReturnToFromLocation()))
}

export default function SignInScreen() {
  const ui = useAppUi()
  const { isAuthenticated, isLoading } = useAuth()
  const { sanitizeReturnPath, isLoading: accessLoading } = useAccess()
  const returnTo = useSignInReturnTo()

  if (isLoading || accessLoading) {
    return (
      <PageCenter>
        <Spinner size="large" color={ui.brand} />
      </PageCenter>
    )
  }

  if (isAuthenticated) {
    return <SpaRedirect href={sanitizeReturnPath(returnTo) as import('one').Href} />
  }

  return <AuthSignInFlow returnTo={returnTo} />
}
