import { Redirect } from 'one'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { PageCenter } from '~/components/layout'
import { Spinner } from '~/components/ui'
import { useAuth } from '~/hooks/useAuth'
import { useAccess } from '~/hooks/useAccess'
import { getReturnToFromLocation } from '~/lib/auth/redirect'

import { useAppUi } from '~/lib/theme/useAppUi'

export default function SignInScreen() {
  const ui = useAppUi()
  const { isAuthenticated, isLoading } = useAuth()
  const { sanitizeReturnPath, isLoading: accessLoading } = useAccess()

  if (isLoading || accessLoading) {
    return (
      <PageCenter>
        <Spinner size="large" color={ui.brand} />
      </PageCenter>
    )
  }

  if (isAuthenticated) {
    return <Redirect href={sanitizeReturnPath(getReturnToFromLocation()) as import('one').Href} />
  }

  return <AuthSignInFlow returnTo={getReturnToFromLocation()} />
}