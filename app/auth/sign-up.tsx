import { Redirect } from 'one'

import { appRoutes } from '~/lib/routes'

/** No separate sign-up — `/auth/sign-up` redirects to the unified OTP flow. */
export default function SignUpRedirect() {
  return <Redirect href={appRoutes.signIn} />
}