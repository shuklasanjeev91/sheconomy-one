import { Redirect } from 'one'

import { coWorkRoutes } from '~/lib/routes'

/** `/co-work/meeting` without a code has nothing to show — go to meetings. */
export default function MeetingIndexRedirect() {
  return <Redirect href={coWorkRoutes.meetings} />
}
