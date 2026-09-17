import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { coWorkRoutes } from '~/lib/routes'

/** Co-Work Main Chat removed — send legacy links to Co-Work home. */
export default function CoWorkMainChatRedirect() {
  return <SpaRedirect href={coWorkRoutes.home} />
}
