import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { appRoutes } from '~/lib/routes'

/** Legacy spelling — same as `/logout`. */
export default function LogOutAliasRedirect() {
  return <SpaRedirect href={appRoutes.logout} />
}
