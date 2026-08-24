import { AppErrorBoundary } from '~/components/AppErrorBoundary'
import { PostDetailScreen } from '~/community/screens/PostDetailScreen'

export default function CommunityPostDetailPage() {
  return (
    <AppErrorBoundary scope="PostDetail">
      <PostDetailScreen />
    </AppErrorBoundary>
  )
}
