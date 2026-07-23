import { useLocalSearchParams } from 'one'

import { RequireAuth } from '~/components/auth/RequireAuth'
import { ContactImportScreen } from '~/features/contacts/screens/ContactImportScreen'

export default function ImportContactsRoute() {
  const params = useLocalSearchParams<{ returnTo?: string }>()

  return (
    <RequireAuth>
      <ContactImportScreen returnTo={params.returnTo ?? null} />
    </RequireAuth>
  )
}
