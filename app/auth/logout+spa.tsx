import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { appRoutes } from '~/lib/routes'

/** Prefer `/logout` — keep `/auth/logout` as an alias. */
export default function AuthLogoutAliasRedirect() {
  return <SpaRedirect href={appRoutes.logout} />
}
