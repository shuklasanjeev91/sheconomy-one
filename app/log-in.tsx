import { appRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** Legacy/short URL — real screen lives at `/auth/sign-in`. */
export default function LogInAliasRedirect() {
  return <SpaRedirect href={appRoutes.signIn} />
}
