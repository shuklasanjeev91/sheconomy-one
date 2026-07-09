import { Redirect } from 'one'

import { RequireAuth } from '~/components/auth/RequireAuth'
import { GenderVerificationScreen } from '~/components/gender-verification/GenderVerificationScreen'
import { useAccess } from '~/hooks/useAccess'
import { communityRoutes } from '~/lib/routes'
import { PageCenter } from '~/components/layout'
import { Spinner } from '~/components/ui'

export default function VerifyGenderRoute() {
  const { isLoading, isFemale } = useAccess()

  return (
    <RequireAuth redirectTo="/auth/verify-gender">
      <VerifyGenderGate isLoading={isLoading} isFemale={isFemale} />
    </RequireAuth>
  )
}

function VerifyGenderGate({ isLoading, isFemale }: { isLoading: boolean; isFemale: boolean }) {
  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" />
      </PageCenter>
    )
  }

  if (isFemale) {
    return <Redirect href={communityRoutes.home} />
  }

  return <GenderVerificationScreen />
}