import { useParams } from 'one'

import { PeopleScreen } from '~/community/screens/PeopleScreen'
import type { UserListKind } from '~/community/lib/user-lists'

export default function CommunityPeopleTabPage() {
  const { tab } = useParams<{ tab: string }>()

  return <PeopleScreen initialTab={tab as UserListKind} />
}