import { useEffect, useMemo, useState } from 'react'
import { useRouter, type Href } from 'one'

import {
  Button,
  Icons,
  Image,
  Input,
  LinearGradient,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { brandColors } from '~/config/brand-colors'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  CMS_CONTENT_STATUSES,
  CMS_CONTENT_TYPES,
  getContentCoverUrl,
  getContentTeaser,
  loadContents,
  type CmsContentDetail,
  type CmsContentStatus,
  type CmsContentType,
} from '~/lib/cms'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'
import { CmsCoverImage } from './CmsCoverImage'

const PAGE_SIZE = 12

type StatusFilter = 'all' | CmsContentStatus
type TypeFilter = 'all' | CmsContentType

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function AdminBlogManager() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

  const { items, contentMeta, isFetching, contentError, isCreating } = useAppSelector((s) => s.cms)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('post')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const filters = useMemo(
    () => ({
      type: typeFilter === 'all' ? undefined : typeFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: debouncedSearch || undefined,
      page: 1,
      limit: PAGE_SIZE,
      order_by: 'updated_at' as const,
      ascending: false,
    }),
    [debouncedSearch, statusFilter, typeFilter],
  )

  useEffect(() => {
    dispatch(loadContents(filters))
  }, [dispatch, filters])

  function openDetail(id: string) {
    router.push(`/admin/blog/${id}` as Href)
  }

  function loadMore() {
    if (!contentMeta.hasNextPage || isFetching) return
    dispatch(loadContents({ ...filters, page: contentMeta.page + 1 }))
  }

  const [featured, ...rest] = items
  const showFeatured = Boolean(isDesktop && featured && !debouncedSearch && statusFilter === 'all')

  return (
    <YStack gap="$5" paddingBottom={safeBottom + 28} width="100%">
      <YStack
        gap="$3"
        padding="$5"
        borderRadius={radius.surface}
        overflow="hidden"
        position="relative"
        backgroundColor={ui.roseSurface}
        borderWidth={1}
        borderColor={ui.borderSubtle}
      >
        <LinearGradient
          fullscreen
          colors={['rgba(208,16,96,0.14)', 'rgba(248,120,64,0.08)', 'transparent']}
          start={[0, 0]}
          end={[1, 1]}
        />
        <XStack
          alignItems="flex-end"
          justifyContent="space-between"
          gap="$3"
          flexWrap="wrap"
          zIndex={1}
        >
          <YStack gap="$2" flex={1} minWidth={240}>
            <Text
              fontSize={12}
              fontWeight="700"
              letterSpacing={1.4}
              textTransform="uppercase"
              color={ui.brand}
            >
              Editorial
            </Text>
            <Text
              fontSize={isDesktop ? 34 : 28}
              fontWeight="800"
              color={ui.text}
              letterSpacing={-0.8}
              lineHeight={isDesktop ? 40 : 34}
            >
              Blog library
            </Text>
            <Text color={ui.textSecondary} fontSize={15} maxWidth={480} lineHeight={22}>
              {contentMeta.total} pieces · tap a card for the full story, likes, and author profile
            </Text>
          </YStack>
          <Button
            tone="outline"
            icon={Icons.RefreshCw}
            disabled={isFetching}
            backgroundColor={ui.surface}
            onPress={() => dispatch(loadContents(filters))}
          >
            Refresh
          </Button>
        </XStack>
      </YStack>

      <BlogFilters
        search={search}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onTypeChange={setTypeFilter}
      />

      {contentError ? (
        <YStack
          padding="$3.5"
          borderRadius={radius.card}
          backgroundColor="$red2"
          borderWidth={1}
          borderColor="$red7"
        >
          <Text color="$red11" fontWeight="700">
            {contentError}
          </Text>
        </YStack>
      ) : null}

      {isFetching && items.length === 0 ? (
        <YStack minHeight={320} alignItems="center" justifyContent="center" gap="$3">
          <Spinner size="large" color={ui.brand} />
          <Text color={ui.textMuted}>Loading stories…</Text>
        </YStack>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <YStack gap="$4">
          {showFeatured && featured ? (
            <FeaturedBlogCard item={featured} onPress={() => openDetail(featured.id)} />
          ) : null}

          <XStack flexWrap="wrap" gap="$4" width="100%">
            {(showFeatured ? rest : items).map((item) => (
              <YStack
                key={item.id}
                width={isDesktop ? '31%' : '100%'}
                minWidth={isDesktop ? 280 : undefined}
                flexGrow={1}
                flexBasis={isDesktop ? 280 : '100%'}
              >
                <BlogCard item={item} onPress={() => openDetail(item.id)} />
              </YStack>
            ))}
          </XStack>

          <XStack justifyContent="center" paddingVertical="$2" gap="$3" alignItems="center">
            <Text color={ui.textMuted} fontSize={13}>
              Showing {items.length} of {contentMeta.total}
            </Text>
            {contentMeta.hasNextPage ? (
              <Button tone="outline" disabled={isFetching || isCreating} onPress={loadMore}>
                {isFetching ? 'Loading…' : 'Load more stories'}
              </Button>
            ) : null}
          </XStack>
        </YStack>
      )}
    </YStack>
  )
}

function EmptyState() {
  const ui = useAppUi()
  return (
    <YStack
      minHeight={280}
      alignItems="center"
      justifyContent="center"
      gap="$3"
      padding="$8"
      borderRadius={radius.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
    >
      <YStack
        width={64}
        height={64}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.roseSurface}
      >
        <Icons.BookOpen size={28} color={ui.brand} />
      </YStack>
      <Text fontWeight="800" fontSize={18} color={ui.text}>
        No stories yet
      </Text>
      <Text color={ui.textMuted} textAlign="center" maxWidth={320}>
        Adjust filters or publish a post — it will appear here as a card.
      </Text>
    </YStack>
  )
}

function BlogFilters({
  search,
  statusFilter,
  typeFilter,
  onSearchChange,
  onStatusChange,
  onTypeChange,
}: {
  search: string
  statusFilter: StatusFilter
  typeFilter: TypeFilter
  onSearchChange: (value: string) => void
  onStatusChange: (value: StatusFilter) => void
  onTypeChange: (value: TypeFilter) => void
}) {
  const ui = useAppUi()
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    ...Object.values(CMS_CONTENT_STATUSES).map((status) => ({
      value: status as StatusFilter,
      label: statusLabel(status),
    })),
  ]
  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All types' },
    ...Object.values(CMS_CONTENT_TYPES).map((type) => ({
      value: type as TypeFilter,
      label: statusLabel(type),
    })),
  ]

  return (
    <XStack
      gap="$3"
      flexWrap="wrap"
      alignItems="center"
      padding="$3"
      borderRadius={radius.card}
      backgroundColor={ui.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      style={getShadowStyle('sm')}
    >
      <XStack flex={1.6} minWidth={200} alignItems="center" gap="$2" paddingHorizontal="$2">
        <Icons.Search size={18} color={ui.textMuted} />
        <Input
          flex={1}
          borderWidth={0}
          backgroundColor="transparent"
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search stories…"
        />
      </XStack>
      <FilterSelect
        value={typeFilter}
        options={typeOptions}
        placeholder="Type"
        minWidth={140}
        onValueChange={(value) => onTypeChange(value as TypeFilter)}
      />
      <FilterSelect
        value={statusFilter}
        options={statusOptions}
        placeholder="Status"
        minWidth={150}
        onValueChange={(value) => onStatusChange(value as StatusFilter)}
      />
    </XStack>
  )
}

function FilterSelect({
  value,
  options,
  placeholder,
  onValueChange,
  minWidth,
}: {
  value: string
  options: { value: string; label: string }[]
  placeholder: string
  onValueChange: (value: string) => void
  minWidth?: number
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger minWidth={minWidth} iconAfter={<Icons.ChevronDown size={16} />}>
        <Select.Value placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent zIndex={300000}>
        <SelectViewport maxHeight={320}>
          {options.map((option, index) => (
            <SelectItem key={option.value} index={index} value={option.value}>
              <Select.ItemText>{option.label}</Select.ItemText>
            </SelectItem>
          ))}
        </SelectViewport>
      </SelectContent>
    </Select>
  )
}

function FeaturedBlogCard({
  item,
  onPress,
}: {
  item: CmsContentDetail
  onPress: () => void
}) {
  const ui = useAppUi()
  const coverUrl = getContentCoverUrl(item)
  const teaser = getContentTeaser(item)
  const authorName = item.author?.full_name || item.author?.username || 'Unknown author'

  return (
    <XStack
      width="100%"
      minHeight={340}
      borderRadius={radius.surface}
      overflow="hidden"
      cursor="pointer"
      pressStyle={{ scale: 0.995, opacity: 0.97 }}
      onPress={onPress}
      backgroundColor={ui.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      style={getShadowStyle('md')}
      flexWrap="wrap"
    >
      <YStack
        flex={1.2}
        minWidth={280}
        minHeight={340}
        height={340}
        position="relative"
        overflow="hidden"
        backgroundColor={ui.roseSurface}
      >
        {coverUrl ? (
          <CmsCoverImage
            url={coverUrl}
            alt={item.cover_media?.alt_text}
            height={340}
          />
        ) : (
          <CoverPlaceholder large />
        )}
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1}
          pointerEvents="none"
          style={{
            background:
              'linear-gradient(180deg, rgba(26,10,18,0.08) 35%, rgba(26,10,18,0.58) 100%)',
          }}
        />
        <XStack position="absolute" top={16} left={16} gap="$2" zIndex={2}>
          <StatusPill status={item.status} />
          {item.is_featured ? <SoftPill label="Featured" /> : null}
        </XStack>
      </YStack>

      <YStack
        flex={1}
        padding="$5"
        gap="$4"
        justifyContent="center"
        minWidth={280}
        minHeight={280}
        backgroundColor={ui.surface}
      >
        <Text
          fontSize={12}
          fontWeight="700"
          letterSpacing={1.1}
          textTransform="uppercase"
          color={ui.brand}
        >
          {item.type} · {formatDate(item.published_at || item.updated_at)}
        </Text>
        <Text fontSize={28} fontWeight="800" color="#1a0a12" letterSpacing={-0.6} lineHeight={34}>
          {item.title?.trim() || 'Untitled'}
        </Text>
        <Text fontSize={15} color="#5c3d4d" lineHeight={23} numberOfLines={3}>
          {teaser || 'Open this story for the full body, SEO, and engagement.'}
        </Text>

        <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
          <AuthorRow item={item} name={authorName} />
          <XStack gap="$3">
            <Metric icon={Icons.Heart} value={item.like_count ?? 0} />
            <Metric icon={Icons.MessageCircle} value={item.comment_count ?? 0} />
            <Metric icon={Icons.Eye} value={item.view_count ?? 0} />
          </XStack>
        </XStack>

        <XStack alignItems="center" gap="$2" marginTop="$1">
          <Text fontWeight="800" color={ui.brand} fontSize={14}>
            Read story
          </Text>
          <Icons.ArrowRight size={16} color={ui.brand} />
        </XStack>
      </YStack>
    </XStack>
  )
}

function BlogCard({
  item,
  onPress,
}: {
  item: CmsContentDetail
  onPress: () => void
}) {
  const ui = useAppUi()
  const coverUrl = getContentCoverUrl(item)
  const teaser = getContentTeaser(item, 120)
  const authorName = item.author?.full_name || item.author?.username || 'Unknown author'
  const title = item.title?.trim() || 'Untitled'

  return (
    <YStack
      width="100%"
      borderRadius={radius.surface}
      overflow="hidden"
      backgroundColor={ui.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      cursor="pointer"
      pressStyle={{ scale: 0.985, opacity: 0.97 }}
      hoverStyle={{ borderColor: brandColors.primaryLight }}
      onPress={onPress}
      style={getShadowStyle('sm')}
    >
      <YStack
        height={200}
        width="100%"
        position="relative"
        overflow="hidden"
        backgroundColor={ui.roseSurface}
      >
        {coverUrl ? (
          <CmsCoverImage url={coverUrl} alt={item.cover_media?.alt_text} height={200} />
        ) : (
          <CoverPlaceholder />
        )}
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1}
          pointerEvents="none"
          style={{
            background:
              'linear-gradient(180deg, rgba(26,10,18,0.05) 40%, rgba(26,10,18,0.55) 100%)',
          }}
        />
        <XStack
          position="absolute"
          top={12}
          left={12}
          right={12}
          justifyContent="space-between"
          zIndex={2}
        >
          <StatusPill status={item.status} />
          <SoftPill label={item.type} />
        </XStack>
        {item.cms_categories?.name ? (
          <Text
            position="absolute"
            bottom={14}
            left={14}
            zIndex={2}
            color="#fff"
            fontSize={11}
            fontWeight="700"
            letterSpacing={0.7}
            textTransform="uppercase"
          >
            {item.cms_categories.name}
          </Text>
        ) : null}
      </YStack>

      <YStack padding="$4" gap="$3" backgroundColor={ui.surface}>
        <YStack gap="$2">
          <Text fontSize={12} color={ui.textMuted} fontWeight="600">
            {formatDate(item.published_at || item.updated_at)}
          </Text>
          <Text
            fontWeight="800"
            fontSize={17}
            color="#1a0a12"
            letterSpacing={-0.35}
            lineHeight={23}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text color="#5c3d4d" fontSize={13.5} lineHeight={20} numberOfLines={2}>
            {teaser || 'No excerpt — open to read the full piece.'}
          </Text>
        </YStack>

        <YStack height={1} backgroundColor={ui.borderSubtle} />

        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <AuthorRow item={item} name={authorName} compact />
          <XStack gap="$2.5">
            <Metric icon={Icons.Heart} value={item.like_count ?? 0} compact />
            <Metric icon={Icons.MessageCircle} value={item.comment_count ?? 0} compact />
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  )
}

function CoverPlaceholder({ large }: { large?: boolean }) {
  return (
    <YStack flex={1} width="100%" height="100%" position="relative" overflow="hidden">
      <LinearGradient
        fullscreen
        colors={[brandColors.roseSurface, brandColors.coralLight, '#fff8f4']}
        start={[0, 0]}
        end={[1, 1]}
      />
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$2.5" zIndex={1}>
        <YStack
          width={large ? 76 : 58}
          height={large ? 76 : 58}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor="rgba(208,16,96,0.12)"
          borderWidth={1}
          borderColor="rgba(208,16,96,0.18)"
        >
          <Icons.PenLine size={large ? 30 : 24} color={brandColors.primary} />
        </YStack>
        <Text
          fontSize={12}
          fontWeight="800"
          color={brandColors.primaryDark}
          letterSpacing={0.8}
          textTransform="uppercase"
        >
          Sheconomy story
        </Text>
      </YStack>
    </YStack>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    published: { bg: '#DCFCE7', fg: '#166534' },
    draft: { bg: brandColors.roseSurface, fg: brandColors.primaryDark },
    review: { bg: '#FEF3C7', fg: '#92400E' },
    scheduled: { bg: '#DBEAFE', fg: '#1E40AF' },
    archived: { bg: '#F3F4F6', fg: '#4B5563' },
  }
  const tone = map[status] ?? map.archived
  return (
    <XStack
      paddingHorizontal="$2.5"
      paddingVertical={5}
      borderRadius={radius.pill}
      backgroundColor={tone.bg}
    >
      <Text fontSize={11} fontWeight="800" color={tone.fg} textTransform="capitalize">
        {status}
      </Text>
    </XStack>
  )
}

function SoftPill({ label }: { label: string }) {
  return (
    <XStack
      paddingHorizontal="$2.5"
      paddingVertical={5}
      borderRadius={radius.pill}
      backgroundColor="rgba(255,255,255,0.94)"
    >
      <Text fontSize={11} fontWeight="800" color="#1a0a12" textTransform="capitalize">
        {label}
      </Text>
    </XStack>
  )
}

function AuthorRow({
  item,
  name,
  compact,
}: {
  item: CmsContentDetail
  name: string
  compact?: boolean
}) {
  const ui = useAppUi()
  const size = compact ? 28 : 34
  return (
    <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
      {item.author?.avatar_url ? (
        <Image
          src={item.author.avatar_url}
          width={size}
          height={size}
          borderRadius={999}
          borderWidth={1.5}
          borderColor={ui.roseSurface}
        />
      ) : (
        <YStack
          width={size}
          height={size}
          borderRadius={999}
          backgroundColor={ui.roseSurface}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.User size={compact ? 13 : 15} color={ui.brand} />
        </YStack>
      )}
      <YStack flex={1} minWidth={0}>
        <Text fontSize={compact ? 12.5 : 13.5} fontWeight="700" color={ui.text} numberOfLines={1}>
          {name}
        </Text>
        {!compact ? (
          <Text fontSize={11} color={ui.textMuted} numberOfLines={1}>
            Author
          </Text>
        ) : null}
      </YStack>
    </XStack>
  )
}

function Metric({
  icon: Icon,
  value,
  compact,
}: {
  icon: typeof Icons.Heart
  value: number
  compact?: boolean
}) {
  const ui = useAppUi()
  return (
    <XStack alignItems="center" gap={compact ? 4 : 6}>
      <Icon size={compact ? 13 : 15} color={ui.textMuted} />
      <Text fontSize={compact ? 12 : 13} fontWeight="700" color={ui.textSecondary}>
        {value}
      </Text>
    </XStack>
  )
}
