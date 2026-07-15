import { appRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** No separate sign-up — `/auth/sign-up` redirects to the unified OTP flow. */
export default function SignUpRedirect() {
  return <SpaRedirect href={appRoutes.signIn} />
}