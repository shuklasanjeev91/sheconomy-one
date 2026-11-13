import { appRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** `/auth` with no child — send guests to the unified sign-in screen. */
export default function AuthIndexRedirect() {
  return <SpaRedirect href={appRoutes.signIn} />
}
