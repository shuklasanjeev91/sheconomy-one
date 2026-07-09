import { CreatePostForm } from '~/community/components/CreatePostForm'
import { CommunityShell } from '~/community/components/CommunityShell'

export function CreatePostScreen() {
  return (
    <CommunityShell>
      <CreatePostForm />
    </CommunityShell>
  )
}