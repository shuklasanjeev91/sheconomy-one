import { Button, Icons, useAppToast } from '~/components/ui'
import { useAuth } from '~/hooks/useAuth'
import { blogRoutes } from '~/lib/routes'
import { toggleLike } from '~/lib/cms'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'

export function BlogLikeButton({
  contentId,
  slug,
  initialCount = 0,
}: {
  contentId: string
  slug: string
  initialCount?: number
}) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const { isAuthenticated, signIn } = useAuth()
  const liked = useAppSelector((s) => !!s.cms.likedContentIds[contentId])
  const count = useAppSelector((s) => s.cms.likeCounts[contentId] ?? initialCount)

  async function handleLike() {
    if (!isAuthenticated) {
      signIn(blogRoutes.post(slug))
      return
    }
    try {
      await dispatch(toggleLike(contentId)).unwrap()
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Could not update like', { tone: 'danger' })
    }
  }

  return (
    <Button
      size="$3"
      tone={liked ? 'primary' : 'outline'}
      icon={Icons.Heart}
      onPress={() => void handleLike()}
    >
      {liked ? 'Liked' : 'Like'} · {count}
    </Button>
  )
}
