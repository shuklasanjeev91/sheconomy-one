import { coWorkRoutes } from '~/lib/routes'
import { SpaRedirect } from '~/components/navigation/SpaRedirect'

/** `/co-work/meeting` without a code has nothing to show — go to meetings. */
export default function MeetingIndexRedirect() {
  return <SpaRedirect href={coWorkRoutes.meetings} />
}
