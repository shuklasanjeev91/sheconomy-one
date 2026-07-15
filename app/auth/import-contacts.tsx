import { useLocalSearchParams } from 'one'

import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { PageCenter } from '~/components/layout'
import { Spinner } from '~/components/ui'
import { ContactImportScreen } from '~/features/contacts/screens/ContactImportScreen'
import { useAuth } from '~/hooks/useAuth'
import { appRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export default function ImportContactsRoute() {
  const ui = useAppUi()
  const { isAuthenticated, isLoading } = useAuth()
  const params = useLocalSearchParams<{ returnTo?: string }>()

  if (isLoading) {
    return (
      <PageCenter>
        <Spinner size="large" color={ui.brand} />
      </PageCenter>
    )
  }

  if (!isAuthenticated) {
    return <SpaRedirect href={appRoutes.signIn} />
  }

  return <ContactImportScreen returnTo={params.returnTo ?? null} />
}
