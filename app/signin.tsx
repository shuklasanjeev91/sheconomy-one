import { appRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** Legacy/short URL — real screen lives at `/auth/sign-in`. */
export default function SigninAliasRedirect() {
  return <SpaRedirect href={appRoutes.signIn} />
}
