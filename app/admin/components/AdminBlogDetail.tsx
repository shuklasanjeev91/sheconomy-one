import { useEffect, useMemo, type ReactNode } from 'react'
import { useRouter, type Href } from 'one'

import {
  Badge,
  Button,
  Icons,
  Image,
  ScrollView,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  calculateSeoScore,
  cleanCmsBody,
  clearCurrentContent,
  getContentCoverUrl,
  getContentTeaser,
  loadComments,
  loadContentById,
  loadContentLikes,
  loadVersions,
  type CmsCommentWithAuthor,
  type CmsProfileRef,
} from '~/lib/cms'
import { appRoutes } from '~/lib/routes'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { CmsCoverImage } from '~/app/admin/components/CmsCoverImage'

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function statusTone(status: string): 'success' | 'warning' | 'neutral' | 'danger' | 'brand' {
  switch (status) {
    case 'published':
      return 'success'
    case 'scheduled':
    case 'review':
      return 'warning'
    case 'archived':
      return 'neutral'
    case 'draft':
      return 'brand'
    default:
      return 'neutral'
  }
}

function profileHref(profile: CmsProfileRef | null | undefined): Href | null {
  if (!profile) return null
  const handle = profile.username?.trim() || profile.id
  return appRoutes.userProfile(handle)
}

export function AdminBlogDetail({ contentId }: { contentId: string }) {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const { isDesktop, safeBottom } = useAppLayout()

  const {
    currentContent,
    isFetching,
    contentError,
    contentLikes,
    contentLikesError,
    comments,
    commentMeta,
    commentError,
    versions,
    versionError,
  } = useAppSelector((s) => s.cms)

  useEffect(() => {
    dispatch(loadContentById(contentId))
    dispatch(loadContentLikes(contentId))
    dispatch(loadComments({ content_id: contentId, page: 1, limit: 50 }))
    dispatch(loadVersions(contentId))
    return () => {
      dispatch(clearCurrentContent())
    }
  }, [contentId, dispatch])

  const tags = useMemo(
    () =>
      (currentContent?.cms_content_tag_map ?? [])
        .map((link) => link.cms_tags)
        .filter(Boolean),
    [currentContent?.cms_content_tag_map],
  )

  const seoScore = useMemo(
    () => (currentContent ? calculateSeoScore(currentContent) : 0),
    [currentContent],
  )

  function openProfile(profile: CmsProfileRef | null | undefined) {
    const href = profileHref(profile)
    if (href) router.push(href)
  }

  if (isFetching && !currentContent) {
    return (
      <YStack minHeight={360} alignItems="center" justifyContent="center" gap="$2">
        <Spinner size="large" />
        <Text color="$color10">Loading article…</Text>
      </YStack>
    )
  }

  if (contentError || !currentContent) {
    return (
      <YStack gap="$3" paddingBottom={safeBottom + 24}>
        <Button tone="ghost" icon={Icons.ArrowLeft} alignSelf="flex-start" onPress={() => router.back()}>
          Back to blog
        </Button>
        <YStack
          padding="$4"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor="$red7"
          backgroundColor="$red2"
          gap="$2"
        >
          <Text fontWeight="800" color="$red11">
            {contentError || 'Content not found'}
          </Text>
          <Text color="$red10">This item may have been deleted or you lack access.</Text>
        </YStack>
      </YStack>
    )
  }

  const content = currentContent
  const coverUrl = getContentCoverUrl(content)
  const teaser = getContentTeaser(content, 220)
  const bodyText = cleanCmsBody(content.body)
  const author = content.author

  return (
    <YStack gap="$4" paddingBottom={safeBottom + 32} width="100%">
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <Button tone="ghost" icon={Icons.ArrowLeft} onPress={() => router.push('/admin/blog' as Href)}>
          All content
        </Button>
        <XStack gap="$2" flexWrap="wrap">
          <Badge tone={statusTone(content.status)}>{content.status}</Badge>
          <Badge tone="neutral">{content.type}</Badge>
          {content.is_featured ? <Badge tone="brand">Featured</Badge> : null}
        </XStack>
      </XStack>

      {/* Hero */}
      <YStack
        borderRadius={radius.card}
        borderWidth={1}
        borderColor="$borderColor"
        backgroundColor="$background"
        overflow="hidden"
        style={getShadowStyle('sm')}
      >
        <YStack
          height={isDesktop ? 280 : 200}
          backgroundColor="$color3"
          position="relative"
          overflow="hidden"
        >
          {coverUrl ? (
            <CmsCoverImage
              url={coverUrl}
              alt={content.cover_media?.alt_text}
              height={isDesktop ? 280 : 200}
            />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
              <Icons.Image size={40} color="$color8" />
              <Text color="$color9">No cover image</Text>
            </YStack>
          )}
        </YStack>

        <YStack padding={isDesktop ? '$5' : '$4'} gap="$3">
          <Text fontSize={isDesktop ? 32 : 24} fontWeight="800" color="$color12" letterSpacing={-0.3}>
            {content.title}
          </Text>
          {teaser ? (
            <Text fontSize={16} color="$color11" lineHeight={24}>
              {teaser}
            </Text>
          ) : null}

          <XStack gap="$3" flexWrap="wrap" alignItems="center">
            <PersonChip profile={author} onPress={() => openProfile(author)} subtitle="Author" />
            <MetaChip
              icon={Icons.Calendar}
              label={`Published ${formatDateTime(content.published_at || content.updated_at)}`}
            />
            <MetaChip icon={Icons.Clock} label={`Updated ${formatDateTime(content.updated_at)}`} />
            {content.cms_categories ? (
              <MetaChip icon={Icons.Folder} label={content.cms_categories.name} />
            ) : null}
          </XStack>
        </YStack>
      </YStack>

      {/* Engagement summary */}
      <XStack gap="$3" flexWrap="wrap">
        <StatCard
          icon={Icons.Heart}
          label="Likes"
          value={content.like_count ?? contentLikes.length}
          hint="People who liked this"
          tone="brand"
        />
        <StatCard
          icon={Icons.MessageCircle}
          label="Comments"
          value={content.comment_count ?? comments.length}
          hint="Including replies"
          tone="success"
        />
        <StatCard
          icon={Icons.Eye}
          label="Views"
          value={content.view_count ?? 0}
          hint="Total view count"
          tone="neutral"
        />
        <StatCard
          icon={Icons.Activity}
          label="SEO score"
          value={seoScore}
          hint="On-page checklist"
          tone="warning"
        />
      </XStack>

      <XStack
        gap="$4"
        flexDirection={isDesktop ? 'row' : 'column'}
        alignItems="stretch"
        width="100%"
      >
        {/* Main column */}
        <YStack flex={isDesktop ? 1.6 : 1} gap="$4" minWidth={0}>
          <Panel title="Body" icon={Icons.FileText}>
            <Text color="$color11" fontSize={15} lineHeight={24} whiteSpace="pre-wrap">
              {bodyText || 'No body content.'}
            </Text>
            <Text marginTop="$3" fontSize={12} color="$color9">
              Format: {content.body_format} · Slug: /{content.slug}
              {content.canonical_url ? ` · ${content.canonical_url}` : ''}
            </Text>
          </Panel>

          <Panel title={`Likes · ${contentLikes.length}`} icon={Icons.Heart}>
            {contentLikesError ? (
              <Text color="$red10">{contentLikesError}</Text>
            ) : contentLikes.length === 0 ? (
              <Text color="$color10">No likes yet.</Text>
            ) : (
              <YStack gap="$2">
                <Text fontSize={13} color="$color10" marginBottom="$1">
                  CMS tracks likes only (there is no dislike table). Tap a person to open their
                  profile.
                </Text>
                {contentLikes.map((like) => (
                  <EngagementPersonRow
                    key={like.id}
                    profile={like.user}
                    when={like.created_at}
                    actionLabel="Liked"
                    onPress={() => openProfile(like.user)}
                  />
                ))}
              </YStack>
            )}
          </Panel>

          <Panel title={`Comments · ${commentMeta.total || comments.length}`} icon={Icons.MessageCircle}>
            {commentError ? (
              <Text color="$red10">{commentError}</Text>
            ) : comments.length === 0 ? (
              <Text color="$color10">No comments yet.</Text>
            ) : (
              <YStack gap="$3">
                {comments.map((comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    onOpenProfile={() => openProfile(comment.author)}
                  />
                ))}
              </YStack>
            )}
          </Panel>
        </YStack>

        {/* Side column */}
        <YStack flex={isDesktop ? 1 : 1} gap="$4" minWidth={isDesktop ? 280 : undefined}>
          <Panel title="Metadata" icon={Icons.Info}>
            <MetaRow label="ID" value={content.id} mono />
            <MetaRow label="Author ID" value={content.author_id} mono />
            <MetaRow label="Category" value={content.cms_categories?.name || '—'} />
            <MetaRow label="Featured" value={content.is_featured ? 'Yes' : 'No'} />
            <MetaRow label="Comments allowed" value={content.allow_comments ? 'Yes' : 'No'} />
            <MetaRow label="Scheduled" value={formatDateTime(content.scheduled_at)} />
            <MetaRow label="Deleted" value={formatDateTime(content.deleted_at)} />
          </Panel>

          <Panel title="SEO" icon={Icons.Search}>
            <MetaRow label="SEO title" value={content.seo_title || '—'} />
            <MetaRow label="SEO description" value={content.seo_description || '—'} />
            <MetaRow label="Focus keyword" value={content.focus_keyword || '—'} />
            <MetaRow label="Canonical" value={content.canonical_url || '—'} />
            <MetaRow
              label="Robots"
              value={`${content.robots_index ? 'index' : 'noindex'}, ${content.robots_follow ? 'follow' : 'nofollow'}`}
            />
            <MetaRow label="Stored SEO score" value={String(content.seo_score ?? seoScore)} />
          </Panel>

          <Panel title="Tags" icon={Icons.Tag}>
            {tags.length === 0 ? (
              <Text color="$color10">No tags</Text>
            ) : (
              <XStack gap="$2" flexWrap="wrap">
                {tags.map((tag) =>
                  tag ? (
                    <Badge key={tag.id} tone="neutral">
                      {tag.name}
                    </Badge>
                  ) : null,
                )}
              </XStack>
            )}
          </Panel>

          <Panel title={`Versions · ${versions.length}`} icon={Icons.History}>
            {versionError ? (
              <Text color="$red10">{versionError}</Text>
            ) : versions.length === 0 ? (
              <Text color="$color10">No versions saved.</Text>
            ) : (
              <ScrollView maxHeight={280}>
                <YStack gap="$2">
                  {versions.map((version) => (
                    <YStack
                      key={version.id}
                      padding="$2.5"
                      borderRadius={radius.chip}
                      backgroundColor="$color2"
                      gap="$1"
                    >
                      <XStack justifyContent="space-between" gap="$2">
                        <Text fontWeight="800" color="$color12">
                          v{version.version_no}
                        </Text>
                        <Badge tone="neutral" size="sm">
                          {version.status}
                        </Badge>
                      </XStack>
                      <Text fontSize={12} color="$color10" numberOfLines={1}>
                        {version.change_note || version.title}
                      </Text>
                      <Text fontSize={11} color="$color9">
                        {formatDateTime(version.created_at)}
                      </Text>
                    </YStack>
                  ))}
                </YStack>
              </ScrollView>
            )}
          </Panel>

          {author ? (
            <Panel title="Author" icon={Icons.User}>
              <PersonChip
                profile={author}
                onPress={() => openProfile(author)}
                subtitle={author.username ? `@${author.username}` : author.id}
                large
              />
              <Button
                marginTop="$3"
                tone="outline"
                icon={Icons.ExternalLink}
                onPress={() => openProfile(author)}
              >
                Open profile
              </Button>
            </Panel>
          ) : null}
        </YStack>
      </XStack>
    </YStack>
  )
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Icons.FileText
  children: ReactNode
}) {
  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$background"
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" gap="$2">
        <YStack
          width={32}
          height={32}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor="$color2"
        >
          <Icon size={16} color="$color10" />
        </YStack>
        <Text fontWeight="800" color="$color12" fontSize={16}>
          {title}
        </Text>
      </XStack>
      {children}
    </YStack>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Icons.Heart
  label: string
  value: number
  hint: string
  tone: 'brand' | 'success' | 'neutral' | 'warning'
}) {
  return (
    <YStack
      flex={1}
      minWidth={140}
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$background"
      gap="$2"
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Badge tone={tone}>{label}</Badge>
        <Icon size={16} color="$color10" />
      </XStack>
      <Text fontSize={28} fontWeight="800" color="$color12">
        {value}
      </Text>
      <Text fontSize={12} color="$color10">
        {hint}
      </Text>
    </YStack>
  )
}

function MetaChip({
  icon: Icon,
  label,
}: {
  icon: typeof Icons.Calendar
  label: string
}) {
  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      paddingHorizontal="$2.5"
      paddingVertical="$1.5"
      borderRadius={999}
      backgroundColor="$color2"
    >
      <Icon size={13} color="$color10" />
      <Text fontSize={12} color="$color11" fontWeight="600">
        {label}
      </Text>
    </XStack>
  )
}

function PersonChip({
  profile,
  onPress,
  subtitle,
  large,
}: {
  profile: CmsProfileRef | null | undefined
  onPress: () => void
  subtitle?: string
  large?: boolean
}) {
  const name = profile?.full_name || profile?.username || 'Unknown'
  const size = large ? 48 : 36

  return (
    <XStack
      alignItems="center"
      gap="$2.5"
      pressStyle={{ opacity: 0.85 }}
      cursor={profile ? 'pointer' : 'default'}
      onPress={profile ? onPress : undefined}
      paddingVertical="$1"
    >
      {profile?.avatar_url ? (
        <Image
          src={profile.avatar_url}
          width={size}
          height={size}
          borderRadius={999}
        />
      ) : (
        <YStack
          width={size}
          height={size}
          borderRadius={999}
          backgroundColor="$color4"
          alignItems="center"
          justifyContent="center"
        >
          <Icons.User size={large ? 22 : 16} color="$color10" />
        </YStack>
      )}
      <YStack minWidth={0} flex={1}>
        <Text fontWeight="800" color="$color12" numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text fontSize={12} color="$blue10" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>
    </XStack>
  )
}

function EngagementPersonRow({
  profile,
  when,
  actionLabel,
  onPress,
}: {
  profile: CmsProfileRef | null
  when: string
  actionLabel: string
  onPress: () => void
}) {
  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      padding="$2.5"
      borderRadius={radius.chip}
      backgroundColor="$color2"
      pressStyle={{ opacity: 0.88 }}
      cursor="pointer"
      onPress={onPress}
    >
      <PersonChip profile={profile} onPress={onPress} subtitle={actionLabel} />
      <Text fontSize={11} color="$color9" flexShrink={0}>
        {formatDateTime(when)}
      </Text>
    </XStack>
  )
}

function CommentRow({
  comment,
  onOpenProfile,
}: {
  comment: CmsCommentWithAuthor
  onOpenProfile: () => void
}) {
  return (
    <YStack
      gap="$2"
      padding="$3"
      borderRadius={radius.chip}
      backgroundColor="$color2"
      borderWidth={1}
      borderColor="$borderColor"
    >
      <XStack justifyContent="space-between" gap="$2" alignItems="flex-start">
        <PersonChip
          profile={comment.author}
          onPress={onOpenProfile}
          subtitle={comment.author?.username ? `@${comment.author.username}` : 'Commenter'}
        />
        <YStack alignItems="flex-end" gap="$1">
          <Text fontSize={11} color="$color9">
            {formatDateTime(comment.created_at)}
          </Text>
          <XStack gap="$1">
            {comment.is_approved ? <Badge tone="success" size="sm">Approved</Badge> : (
              <Badge tone="warning" size="sm">Pending</Badge>
            )}
            {comment.is_flagged ? <Badge tone="danger" size="sm">Flagged</Badge> : null}
          </XStack>
        </YStack>
      </XStack>
      <Text color="$color12" fontSize={14} lineHeight={21}>
        {comment.body}
      </Text>
    </YStack>
  )
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <YStack gap="$0.5" paddingVertical="$1.5" borderBottomWidth={1} borderBottomColor="$borderColor">
      <Text fontSize={11} fontWeight="700" color="$color9" textTransform="uppercase" letterSpacing={0.4}>
        {label}
      </Text>
      <Text
        fontSize={13}
        color="$color12"
        fontFamily={mono ? '$mono' : undefined}
        numberOfLines={3}
      >
        {value}
      </Text>
    </YStack>
  )
}
