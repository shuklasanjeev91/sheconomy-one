import { RequireAuth } from '~/components/auth/RequireAuth'
import { CreatePostScreen } from '~/community/screens/CreatePostScreen'

export default function CreatePostRoute() {
  return (
    <RequireAuth redirectTo="/community/create">
      <CreatePostScreen />
    </RequireAuth>
  )
}