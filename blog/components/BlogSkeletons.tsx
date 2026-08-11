import { Skeleton, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BlogPostsGrid } from '~/blog/components/BlogPostsGrid'

export function BlogListSkeleton({ count = 6 }: { count?: number }) {
  const ui = useAppUi()

  return (
    <BlogPostsGrid>
      {Array.from({ length: count }).map((_, i) => (
        <YStack
          key={i}
          width="100%"
          minWidth={0}
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surface}
          overflow="hidden"
        >
          <Skeleton height={200} borderRadius={0} />
          <YStack padding="$4" gap="$2.5">
            <Skeleton height={12} width="40%" />
            <Skeleton height={18} width="85%" />
            <Skeleton height={12} width="100%" />
            <Skeleton height={12} width="70%" />
          </YStack>
        </YStack>
      ))}
    </BlogPostsGrid>
  )
}

export function BlogFeaturedSkeleton() {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  return (
    <XStack
      width="100%"
      flexDirection={isDesktop ? 'row' : 'column'}
      borderRadius={radius.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      overflow="hidden"
      backgroundColor={ui.surface}
    >
      <Skeleton height={isDesktop ? 320 : 220} width={isDesktop ? '50%' : '100%'} borderRadius={0} />
      <YStack flex={1} padding="$5" gap="$3" justifyContent="center">
        <Skeleton height={20} width={100} borderRadius={999} />
        <Skeleton height={28} width="90%" />
        <Skeleton height={14} width="100%" />
        <Skeleton height={14} width="70%" />
        <Skeleton height={40} width={160} borderRadius={999} />
      </YStack>
    </XStack>
  )
}

export function BlogPostSkeleton() {
  return (
    <YStack maxWidth={760} width="100%" alignSelf="center" gap="$4" paddingVertical="$6">
      <Skeleton height={16} width={120} borderRadius={999} />
      <Skeleton height={36} width="90%" />
      <Skeleton height={20} width="70%" />
      <Skeleton height={280} width="100%" borderRadius={16} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} height={14} width={`${90 - i * 5}%`} />
      ))}
    </YStack>
  )
}
