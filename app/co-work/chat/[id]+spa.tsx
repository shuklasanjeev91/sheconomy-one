import { SpaRedirect } from '~/components/navigation/SpaRedirect'
import { coWorkRoutes } from '~/lib/routes'

/** Co-Work Main Chat removed — send legacy thread links to Co-Work home. */
export default function CoWorkMainChatThreadRedirect() {
  return <SpaRedirect href={coWorkRoutes.home} />
}
