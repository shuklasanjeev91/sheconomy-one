import { CmsCoverImage } from '~/app/admin/components/CmsCoverImage'
import { Badge, Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { getContentCoverUrl, getContentTeaser, type CmsContentDetail } from '~/lib/cms'
import { navigateApp } from '~/lib/platform/navigate'
import { blogRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { estimateReadTime, formatBlogDate } from '~/blog/lib/blog-utils'

export function BlogFeaturedCard({ post }: { post: CmsContentDetail }) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const cover = getContentCoverUrl(post)
  const teaser = getContentTeaser(post, 250)
  const readTime = estimateReadTime(post.body || '')
  const authorName = post.author?.full_name || post.author?.username || 'SHEconomy Team'

  return (
    <XStack
      width="100%"
      flexDirection={isDesktop ? 'row' : 'column'}
      borderRadius={radius.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      overflow="hidden"
      cursor="pointer"
      style={getShadowStyle('md')}
      hoverStyle={{ borderColor: ui.brand }}
      pressStyle={{ opacity: 0.97 }}
      onPress={() => navigateApp(blogRoutes.post(post.slug))}
      role="link"
    >
      <YStack
        width={isDesktop ? '50%' : '100%'}
        height={isDesktop ? 320 : 240}
        backgroundColor={ui.roseSurface}
        flexShrink={0}
      >
        {cover ? (
          <CmsCoverImage url={cover} alt={post.title} width="100%" height={isDesktop ? 320 : 240} />
        ) : (
          <YStack flex={1} height="100%" alignItems="center" justifyContent="center">
            <Icons.FileText size={48} color={ui.brand} />
          </YStack>
        )}
      </YStack>

      <YStack
        flex={1}
        gap="$3"
        padding={isDesktop ? '$6' : '$4'}
        justifyContent="center"
        minWidth={0}
      >
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Badge tone="brand">Featured</Badge>
          {post.cms_categories?.name ? (
            <Badge tone="neutral">{post.cms_categories.name}</Badge>
          ) : null}
        </XStack>

        <Text
          fontSize={isDesktop ? 32 : 24}
          fontWeight="800"
          color={ui.text}
          letterSpacing={-0.4}
          numberOfLines={3}
        >
          {post.title}
        </Text>

        {teaser ? (
          <Text fontSize={15} color={ui.textSecondary} lineHeight={22} numberOfLines={3}>
            {teaser}
          </Text>
        ) : null}

        <XStack gap="$4" flexWrap="wrap" alignItems="center">
          <XStack gap="$1.5" alignItems="center">
            <Icons.Calendar size={14} color={ui.textMuted} />
            <Text fontSize={13} color={ui.textMuted}>
              {formatBlogDate(post.published_at ?? post.created_at, 'long')}
            </Text>
          </XStack>
          <XStack gap="$1.5" alignItems="center">
            <Icons.Clock size={14} color={ui.textMuted} />
            <Text fontSize={13} color={ui.textMuted}>
              {readTime} min read
            </Text>
          </XStack>
          <Text fontSize={13} color={ui.textMuted}>
            By {authorName}
          </Text>
        </XStack>

        <Button size="$4" iconAfter={Icons.ArrowRight} alignSelf="flex-start" pointerEvents="none">
          Read Full Story
        </Button>
      </YStack>
    </XStack>
  )
}
