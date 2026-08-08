import { Platform } from 'react-native'
import { useRouter } from 'one'

import { CmsCoverImage } from '~/app/admin/components/CmsCoverImage'
import { Badge, Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { getContentCoverUrl, getContentTeaser, type CmsContentDetail } from '~/lib/cms'
import { blogRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

import { estimateReadTime, formatBlogDate, formatCount } from '~/blog/lib/blog-utils'

/** Stable column width for the blog grid (avoids % + flexGrow collapse). */
export function blogCardColumnWidth(isDesktop: boolean, isTablet: boolean) {
  if (Platform.OS === 'web') {
    if (isDesktop) return 'calc((100% - 32px) / 3)'
    if (isTablet) return 'calc((100% - 16px) / 2)'
    return '100%'
  }
  return '100%'
}

export function BlogCard({ post }: { post: CmsContentDetail }) {
  const ui = useAppUi()
  const router = useRouter()
  const cover = getContentCoverUrl(post)
  const teaser = getContentTeaser(post, 150)
  const readTime = estimateReadTime(post.body || '')

  return (
    <YStack
      width="100%"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      overflow="hidden"
      cursor="pointer"
      style={getShadowStyle('sm')}
      hoverStyle={{ borderColor: ui.brand, y: -2 }}
      pressStyle={{ opacity: 0.96 }}
      onPress={() => router.push(blogRoutes.post(post.slug))}
      role="link"
    >
      <YStack height={200} backgroundColor={ui.surfaceMuted} width="100%" position="relative">
        {cover ? (
          <CmsCoverImage url={cover} alt={post.title} height={200} />
        ) : (
          <YStack
            height={200}
            width="100%"
            alignItems="center"
            justifyContent="center"
            backgroundColor={ui.roseSurface}
          >
            <Icons.FileText size={36} color={ui.brand} />
          </YStack>
        )}
        {post.cms_categories?.name ? (
          <YStack position="absolute" left={12} bottom={12}>
            <Badge tone="neutral" size="sm">
              {post.cms_categories.name}
            </Badge>
          </YStack>
        ) : null}
      </YStack>

      <YStack padding="$4" gap="$2.5">
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <XStack gap="$1.5" alignItems="center">
            <Icons.Calendar size={12} color={ui.textMuted} />
            <Text fontSize={12} color={ui.textMuted}>
              {formatBlogDate(post.published_at ?? post.created_at)}
            </Text>
          </XStack>
          <XStack gap="$1.5" alignItems="center">
            <Icons.Clock size={12} color={ui.textMuted} />
            <Text fontSize={12} color={ui.textMuted}>
              {readTime} min read
            </Text>
          </XStack>
        </XStack>

        <Text fontSize={17} fontWeight="800" color={ui.text} numberOfLines={2} letterSpacing={-0.2}>
          {post.title}
        </Text>

        {teaser ? (
          <Text fontSize={14} color={ui.textSecondary} numberOfLines={3} lineHeight={20}>
            {teaser}
          </Text>
        ) : null}

        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingTop="$3"
          borderTopWidth={1}
          borderTopColor={ui.borderSubtle}
          gap="$2"
        >
          <XStack gap="$3" alignItems="center">
            <XStack gap="$1" alignItems="center">
              <Icons.Eye size={13} color={ui.textMuted} />
              <Text fontSize={11} color={ui.textMuted}>
                {formatCount(post.view_count ?? 0)}
              </Text>
            </XStack>
            <XStack gap="$1" alignItems="center">
              <Icons.Heart size={13} color={ui.textMuted} />
              <Text fontSize={11} color={ui.textMuted}>
                {formatCount(post.like_count ?? 0)}
              </Text>
            </XStack>
            <XStack gap="$1" alignItems="center">
              <Icons.MessageSquare size={13} color={ui.textMuted} />
              <Text fontSize={11} color={ui.textMuted}>
                {formatCount(post.comment_count ?? 0)}
              </Text>
            </XStack>
          </XStack>
          <Text fontSize={12} fontWeight="700" color={ui.brand}>
            Read more →
          </Text>
        </XStack>
      </YStack>
    </YStack>
  )
}
