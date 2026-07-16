import { Platform } from 'react-native'

import { RequireAuth } from '~/components/auth/RequireAuth'
import { CompleteProfileFlow } from '~/components/auth/CompleteProfileFlow'
import { AuthShell } from '~/components/auth/AuthShell'
import { getSearchParam } from '~/lib/platform/url'
import { appRoutes } from '~/lib/routes'

function readParam(key: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get(key) ?? ''
  }
  return getSearchParam(key) ?? ''
}

export default function CompleteProfileRoute() {
  const returnTo = readParam('returnTo')
  const isNewUser = readParam('isNewUser') === '1'

  return (
    <RequireAuth redirectTo={String(appRoutes.signIn)}>
      <AuthShell>
        <CompleteProfileFlow returnTo={returnTo || undefined} isNewUser={isNewUser} />
      </AuthShell>
    </RequireAuth>
  )
}
