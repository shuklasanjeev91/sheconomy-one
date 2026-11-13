import { appRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** No separate sign-up — unified OTP flow. */
export default function SignUpAliasRedirect() {
  return <SpaRedirect href={appRoutes.signIn} />
}
