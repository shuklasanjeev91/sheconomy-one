import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { PostDetailScreen } from '~/community/screens/PostDetailScreen'

/** Native post detail — avoid One `useLoader` (empty/slow on device). */
export default function CommunityPostDetailNativePage() {
  return (
    <AppErrorBoundary scope="PostDetail">
      <PostDetailScreen />
    </AppErrorBoundary>
  )
}
