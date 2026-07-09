import { useParams } from 'one'

import { PeopleScreen } from '~/community/screens/PeopleScreen'

export default function ProfileConnectionsPage() {
  const { username } = useParams<{ username: string }>()

  return <PeopleScreen profileHandle={username} initialTab="connections" />
}