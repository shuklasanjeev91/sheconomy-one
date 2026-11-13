import { appRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** No separate sign-up — unified OTP flow. */
export default function SignupAliasRedirect() {
  return <SpaRedirect href={appRoutes.signIn} />
}
