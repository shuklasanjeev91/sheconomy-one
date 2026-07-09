import { useParams } from 'one'

import { PeopleScreen } from '~/community/screens/PeopleScreen'

export default function ProfileFollowersPage() {
  const { username } = useParams<{ username: string }>()

  return <PeopleScreen profileHandle={username} initialTab="followers" />
}