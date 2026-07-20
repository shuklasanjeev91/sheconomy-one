import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  Badge,
  Button,
  Field,
  Icons,
  Image,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Spinner,
  Text,
  TextArea,
  useAppToast,
  XStack,
  YStack,
  AppBottomSheet,
} from '~/components/ui'
import { ImageUploadField } from '~/components/media/ImageUploadField'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { pickedImageToBlob, type PickedImage } from '~/lib/media/pick-image'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import {
  COMPANY_PAGE_CATEGORIES,
  COMPANY_PAGE_SIZES,
  COMPANY_PAGE_TYPES,
  DEFAULT_COMPANY_PAGE_LIMIT,
  DEFAULT_PAGE_CATEGORY,
  clearCurrentCompanyPage,
  createCompanyPage,
  deleteCompanyCover,
  deleteCompanyLogo,
  deleteCompanyPage,
  formatCompanyMemberRole,
  formatFoundedYear,
  generateCompanyPageSlug,
  getCompanyDisplayLocation,
  getCompanySubtitle,
  isCompanyStorageUrl,
  loadCompanyPageDetail,
  loadCompanyPageFacets,
  loadCompanyPagePlatformStats,
  loadCompanyPages,
  removeCompanyMember,
  setCompanyMemberRole,
  updateCompanyPage,
  uploadCompanyCover,
  uploadCompanyLogo,
  validateCompanyImageFile,
  type CompanyPageDetail,
  type CompanyPageWithCounts,
} from '~/lib/company-page'

// ============================================================================
// TYPES
// ============================================================================

type FormMode = 'create' | 'edit'

type PageFormState = {
  name: string
  page_slug: string
  slugTouched: boolean
  industry: string
  size: string
  type: string
  page_category: string
  tagline: string
  website: string
  location: string
  headquarters: string
  founded_year: string
  logoUrl: string
  coverUrl: string
  logoPick: PickedImage[]
  coverPick: PickedImage[]
}

const EMPTY_FORM: PageFormState = {
  name: '',
  page_slug: '',
  slugTouched: false,
  industry: '',
  size: COMPANY_PAGE_SIZES[0],
  type: COMPANY_PAGE_TYPES[0],
  page_category: DEFAULT_PAGE_CATEGORY,
  tagline: '',
  website: '',
  location: '',
  headquarters: '',
  founded_year: '',
  logoUrl: '',
  coverUrl: '',
  logoPick: [],
  coverPick: [],
}

function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Invalid date'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ============================================================================
// MAIN
// ============================================================================

export function AdminCompanyPagesManager() {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

  const {
    pages,
    totalPages,
    hasMore,
    currentPage,
    facets,
    platformStats,
    isLoadingList,
    isLoadingDetail,
    isSaving,
    isDeleting,
    isUpdatingMember,
    error,
  } = useAppSelector((state) => state.companyPage)

  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [originalLogo, setOriginalLogo] = useState<string | null>(null)
  const [originalCover, setOriginalCover] = useState<string | null>(null)
  const [form, setForm] = useState<PageFormState>(EMPTY_FORM)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CompanyPageWithCounts | null>(null)

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      industry: industryFilter === 'all' ? undefined : industryFilter,
      size: sizeFilter === 'all' ? undefined : sizeFilter,
      type: typeFilter === 'all' ? undefined : typeFilter,
      page_category: categoryFilter === 'all' ? undefined : categoryFilter,
    }),
    [search, industryFilter, sizeFilter, typeFilter, categoryFilter],
  )

  useEffect(() => {
    dispatch(loadCompanyPagePlatformStats())
    dispatch(loadCompanyPageFacets())
  }, [dispatch])

  useEffect(() => {
    dispatch(loadCompanyPages({ filters, limit: DEFAULT_COMPANY_PAGE_LIMIT, offset: 0 }))
  }, [dispatch, filters])

  const patchForm = useCallback((patch: Partial<PageFormState>) => {
    setForm((current) => ({ ...current, ...patch }))
  }, [])

  function openCreateForm() {
    setFormMode('create')
    setEditingId(null)
    setOriginalLogo(null)
    setOriginalCover(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEditForm(page: CompanyPageWithCounts | CompanyPageDetail) {
    setFormMode('edit')
    setEditingId(page.id)
    setOriginalLogo(page.logo_url ?? null)
    setOriginalCover(page.cover_url ?? null)
    setForm({
      name: page.name ?? '',
      page_slug: page.page_slug ?? '',
      slugTouched: true,
      industry: page.industry ?? '',
      size: page.size || COMPANY_PAGE_SIZES[0],
      type: page.type || COMPANY_PAGE_TYPES[0],
      page_category: page.page_category || DEFAULT_PAGE_CATEGORY,
      tagline: page.tagline ?? '',
      website: page.website ?? '',
      location: page.location ?? '',
      headquarters: page.headquarters ?? '',
      founded_year: page.founded_year != null ? String(page.founded_year) : '',
      logoUrl: page.logo_url ?? '',
      coverUrl: page.cover_url ?? '',
      logoPick: [],
      coverPick: [],
    })
    setFormOpen(true)
  }

  async function uploadPickedImage(
    picked: PickedImage,
    kind: 'logo' | 'cover',
    pageId?: string | null,
  ): Promise<string | null> {
    const blob = await pickedImageToBlob(picked)
    const fileArg = {
      blob,
      mimeType: picked.mimeType || blob.type || 'image/jpeg',
      fileName: picked.fileName || `${kind}-${Date.now()}.jpg`,
      fileSize: picked.file?.size ?? blob.size,
    }
    const check = validateCompanyImageFile(fileArg)
    if (!check.valid) {
      toast.show('Invalid image', { tone: 'danger', message: check.error })
      return null
    }
    const res =
      kind === 'logo'
        ? await uploadCompanyLogo(fileArg, pageId ?? undefined)
        : await uploadCompanyCover(fileArg, pageId ?? undefined)
    if (!res.success || !res.data) {
      toast.show(`${kind === 'logo' ? 'Logo' : 'Cover'} upload failed`, {
        tone: 'danger',
        message: res.error ?? undefined,
      })
      return null
    }
    return res.data.url
  }

  async function submitPage() {
    if (!form.name.trim() || !form.page_slug.trim() || !form.industry.trim()) {
      toast.show('Missing required fields', {
        tone: 'danger',
        message: 'Name, slug, and industry are required.',
      })
      return
    }

    let logoUrl: string | null = form.logoUrl.trim() || null
    let coverUrl: string | null = form.coverUrl.trim() || null

    try {
      setUploadingMedia(true)
      if (form.logoPick[0]) {
        const url = await uploadPickedImage(form.logoPick[0], 'logo', editingId)
        if (!url) {
          setUploadingMedia(false)
          return
        }
        logoUrl = url
      }
      if (form.coverPick[0]) {
        const url = await uploadPickedImage(form.coverPick[0], 'cover', editingId)
        if (!url) {
          setUploadingMedia(false)
          return
        }
        coverUrl = url
      }
      setUploadingMedia(false)

      const founded = form.founded_year.trim()
        ? parseInt(form.founded_year.trim(), 10)
        : null

      const payload = {
        name: form.name.trim(),
        page_slug: form.page_slug.trim().toLowerCase(),
        industry: form.industry.trim(),
        size: form.size,
        type: form.type,
        page_category: form.page_category,
        tagline: nullableText(form.tagline),
        website: nullableText(form.website),
        location: nullableText(form.location),
        headquarters: nullableText(form.headquarters),
        founded_year: Number.isNaN(founded as number) ? null : founded,
        logo_url: logoUrl,
        cover_url: coverUrl,
      }

      if (formMode === 'create') {
        await dispatch(createCompanyPage(payload)).unwrap()
        toast.show('Company page created', {
          tone: 'success',
          message: `"${payload.name}" is ready.`,
        })
      } else if (editingId) {
        await dispatch(updateCompanyPage({ pageId: editingId, payload })).unwrap()
        toast.show('Company page updated', { tone: 'success', message: 'Your changes were saved.' })
        if (isCompanyStorageUrl(originalLogo) && originalLogo !== logoUrl) {
          void deleteCompanyLogo(originalLogo)
        }
        if (isCompanyStorageUrl(originalCover) && originalCover !== coverUrl) {
          void deleteCompanyCover(originalCover)
        }
      }
      setFormOpen(false)
      dispatch(loadCompanyPagePlatformStats())
    } catch (message) {
      setUploadingMedia(false)
      toast.show('Could not save page', { tone: 'danger', message: String(message) })
    }
  }

  function openDetail(pageId: string) {
    setDetailOpen(true)
    dispatch(loadCompanyPageDetail(pageId))
  }

  function closeDetail() {
    setDetailOpen(false)
    dispatch(clearCurrentCompanyPage())
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await dispatch(deleteCompanyPage(target.id)).unwrap()
      toast.show('Page deleted', { tone: 'success', message: `"${target.name}" was removed.` })
      if (isCompanyStorageUrl(target.logo_url)) void deleteCompanyLogo(target.logo_url)
      if (isCompanyStorageUrl(target.cover_url)) void deleteCompanyCover(target.cover_url)
      setDeleteTarget(null)
      dispatch(loadCompanyPagePlatformStats())
    } catch (message) {
      toast.show('Could not delete page', { tone: 'danger', message: String(message) })
    }
  }

  function loadMore() {
    dispatch(
      loadCompanyPages({
        filters,
        limit: DEFAULT_COMPANY_PAGE_LIMIT,
        offset: pages.length,
      }),
    )
  }

  const busy = isSaving || uploadingMedia

  return (
    <YStack
      width="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop="$5"
      paddingBottom={safeBottom + 28}
    >
      <CompanyHeader
        ui={ui}
        stats={platformStats}
        total={totalPages}
        onCreate={openCreateForm}
        onRefresh={() => {
          dispatch(loadCompanyPages({ filters, limit: DEFAULT_COMPANY_PAGE_LIMIT, offset: 0 }))
          dispatch(loadCompanyPagePlatformStats())
        }}
      />

      {error ? (
        <YStack
          padding="$3"
          borderRadius={radius.card}
          backgroundColor="$red3"
          borderWidth={1}
          borderColor="$red7"
        >
          <Text color="$red11" fontWeight="700">
            {error}
          </Text>
        </YStack>
      ) : null}

      <CompanyFilters
        ui={ui}
        search={search}
        industryFilter={industryFilter}
        sizeFilter={sizeFilter}
        typeFilter={typeFilter}
        categoryFilter={categoryFilter}
        facets={facets}
        onSearchChange={setSearch}
        onIndustryChange={setIndustryFilter}
        onSizeChange={setSizeFilter}
        onTypeChange={setTypeFilter}
        onCategoryChange={setCategoryFilter}
      />

      <CompanyPageList
        ui={ui}
        pages={pages}
        total={totalPages}
        loading={isLoadingList}
        hasMore={hasMore}
        isDesktop={isDesktop}
        onOpen={openDetail}
        onEdit={openEditForm}
        onDelete={setDeleteTarget}
        onLoadMore={loadMore}
      />

      <PageFormSheet
        ui={ui}
        open={formOpen}
        mode={formMode}
        form={form}
        busy={busy}
        uploadingMedia={uploadingMedia}
        onOpenChange={setFormOpen}
        onChange={patchForm}
        onSubmit={submitPage}
      />

      <PageDetailSheet
        ui={ui}
        open={detailOpen}
        isDesktop={isDesktop}
        page={currentPage}
        loading={isLoadingDetail}
        updatingMember={isUpdatingMember}
        onOpenChange={(open) => (open ? setDetailOpen(true) : closeDetail())}
        onEdit={() => {
          if (!currentPage) return
          setDetailOpen(false)
          openEditForm(currentPage)
        }}
        onDelete={() => {
          if (!currentPage) return
          setDetailOpen(false)
          setDeleteTarget(currentPage)
        }}
        onSetMemberRole={async (userId, role) => {
          if (!currentPage) return
          try {
            await dispatch(
              setCompanyMemberRole({ companyId: currentPage.id, userId, role }),
            ).unwrap()
            toast.show('Member updated', { tone: 'success' })
          } catch (message) {
            toast.show('Could not update member', { tone: 'danger', message: String(message) })
          }
        }}
        onRemoveMember={async (userId) => {
          if (!currentPage) return
          try {
            await dispatch(removeCompanyMember({ companyId: currentPage.id, userId })).unwrap()
            toast.show('Member removed', { tone: 'success' })
          } catch (message) {
            toast.show('Could not remove member', { tone: 'danger', message: String(message) })
          }
        }}
      />

      <ConfirmDeleteSheet
        ui={ui}
        page={deleteTarget}
        busy={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </YStack>
  )
}

// ============================================================================
// HEADER
// ============================================================================

function CompanyHeader({
  ui,
  stats,
  total,
  onCreate,
  onRefresh,
}: {
  ui: AppUiTokens
  stats: {
    totalPages: number
    pagesThisMonth: number
    totalFollowers: number
    totalMembers: number
  } | null
  total: number
  onCreate: () => void
  onRefresh: () => void
}) {
  const cards = [
    { label: 'Total pages', value: stats?.totalPages ?? total, tone: 'info' as const, icon: Icons.Building2 },
    { label: 'This month', value: stats?.pagesThisMonth ?? 0, tone: 'brand' as const, icon: Icons.Calendar },
    { label: 'Followers', value: stats?.totalFollowers ?? 0, tone: 'success' as const, icon: Icons.Users },
    { label: 'Members', value: stats?.totalMembers ?? 0, tone: 'warning' as const, icon: Icons.UserCheck },
  ]

  return (
    <YStack gap="$3.5">
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minWidth={220}>
          <Text fontSize={26} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
            Company Pages
          </Text>
          <Text color={ui.textSecondary}>
            Browse company pages, review logos and covers, and manage create, update, and delete.
          </Text>
        </YStack>
        <XStack gap="$2">
          <Button tone="outline" icon={Icons.RefreshCw} onPress={onRefresh}>
            Refresh
          </Button>
          <Button icon={Icons.Plus} onPress={onCreate}>
            Create page
          </Button>
        </XStack>
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        {cards.map((card) => {
          const CardIcon = card.icon ?? Icons.Circle
          return (
            <YStack
              key={card.label}
              flex={1}
              minWidth={150}
              gap="$2"
              padding="$4"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
              style={getShadowStyle('sm')}
            >
              <XStack alignItems="center" justifyContent="space-between">
                <YStack
                  width={36}
                  height={36}
                  borderRadius={radius.chip}
                  backgroundColor={ui.roseSurface}
                  alignItems="center"
                  justifyContent="center"
                >
                  <CardIcon size={18} color={ui.brand} />
                </YStack>
                <Badge tone={card.tone} size="sm">
                  {card.label}
                </Badge>
              </XStack>
              <Text fontSize={26} fontWeight="800" color={ui.text} letterSpacing={-0.6}>
                {card.value}
              </Text>
            </YStack>
          )
        })}
      </XStack>
    </YStack>
  )
}

// ============================================================================
// FILTERS
// ============================================================================

function CompanyFilters({
  ui,
  search,
  industryFilter,
  sizeFilter,
  typeFilter,
  categoryFilter,
  facets,
  onSearchChange,
  onIndustryChange,
  onSizeChange,
  onTypeChange,
  onCategoryChange,
}: {
  ui: AppUiTokens
  search: string
  industryFilter: string
  sizeFilter: string
  typeFilter: string
  categoryFilter: string
  facets: {
    industries: string[]
    sizes: string[]
    types: string[]
    categories: string[]
  } | null
  onSearchChange: (v: string) => void
  onIndustryChange: (v: string) => void
  onSizeChange: (v: string) => void
  onTypeChange: (v: string) => void
  onCategoryChange: (v: string) => void
}) {
  const industries = facets?.industries?.length
    ? facets.industries
    : []
  const sizes = facets?.sizes?.length ? facets.sizes : [...COMPANY_PAGE_SIZES]
  const types = facets?.types?.length ? facets.types : [...COMPANY_PAGE_TYPES]
  const categories = facets?.categories?.length
    ? facets.categories
    : [...COMPANY_PAGE_CATEGORIES]

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <XStack gap="$3" flexWrap="wrap" alignItems="flex-end">
        <Field label="Search" flex={1.6} minWidth={220}>
          <Input
            value={search}
            onChangeText={onSearchChange}
            placeholder="Search by name, slug, industry, or location"
          />
        </Field>
        <Field label="Industry" flex={1} minWidth={160}>
          <PickerSelect
            value={industryFilter}
            options={[
              { value: 'all', label: 'All industries' },
              ...industries.map((v) => ({ value: v, label: v })),
            ]}
            placeholder="Industry"
            onValueChange={onIndustryChange}
          />
        </Field>
        <Field label="Size" flex={1} minWidth={140}>
          <PickerSelect
            value={sizeFilter}
            options={[
              { value: 'all', label: 'All sizes' },
              ...sizes.map((v) => ({ value: v, label: v })),
            ]}
            placeholder="Size"
            onValueChange={onSizeChange}
          />
        </Field>
        <Field label="Type" flex={1} minWidth={140}>
          <PickerSelect
            value={typeFilter}
            options={[
              { value: 'all', label: 'All types' },
              ...types.map((v) => ({ value: v, label: v })),
            ]}
            placeholder="Type"
            onValueChange={onTypeChange}
          />
        </Field>
        <Field label="Category" flex={1} minWidth={150}>
          <PickerSelect
            value={categoryFilter}
            options={[
              { value: 'all', label: 'All categories' },
              ...categories.map((v) => ({ value: v, label: v })),
            ]}
            placeholder="Category"
            onValueChange={onCategoryChange}
          />
        </Field>
      </XStack>
    </YStack>
  )
}

function PickerSelect({
  value,
  options,
  placeholder,
  onValueChange,
}: {
  value: string
  options: { value: string; label: string }[]
  placeholder: string
  onValueChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} />}>
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

// ============================================================================
// LIST + CARD
// ============================================================================

function CompanyPageList({
  ui,
  pages,
  total,
  loading,
  hasMore,
  isDesktop,
  onOpen,
  onEdit,
  onDelete,
  onLoadMore,
}: {
  ui: AppUiTokens
  pages: CompanyPageWithCounts[]
  total: number
  loading: boolean
  hasMore: boolean
  isDesktop: boolean
  onOpen: (id: string) => void
  onEdit: (page: CompanyPageWithCounts) => void
  onDelete: (page: CompanyPageWithCounts) => void
  onLoadMore: () => void
}) {
  if (loading && pages.length === 0) {
    return (
      <YStack minHeight={260} alignItems="center" justifyContent="center" gap="$2">
        <Spinner size="large" />
        <Text color={ui.textMuted}>Loading company pages…</Text>
      </YStack>
    )
  }

  if (!pages.length) {
    return (
      <YStack
        minHeight={240}
        alignItems="center"
        justifyContent="center"
        gap="$2"
        padding="$5"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <YStack
          width={56}
          height={56}
          borderRadius={999}
          backgroundColor={ui.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          <Icons.Building2 size={26} color={ui.textMuted} />
        </YStack>
        <Text fontWeight="800" color={ui.text}>
          No company pages found
        </Text>
        <Text color={ui.textMuted} textAlign="center">
          Create your first page or adjust the filters above.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="800" color={ui.text}>
          All pages
        </Text>
        <Text color={ui.textMuted}>
          {pages.length} of {total}
        </Text>
      </XStack>

      <XStack flexWrap="wrap" gap="$3.5">
        {pages.map((page) => (
          <CompanyPageCard
            key={page.id}
            ui={ui}
            page={page}
            isDesktop={isDesktop}
            onOpen={() => onOpen(page.id)}
            onEdit={() => onEdit(page)}
            onDelete={() => onDelete(page)}
          />
        ))}
      </XStack>

      {hasMore ? (
        <Button tone="outline" onPress={onLoadMore} disabled={loading}>
          {loading ? 'Loading…' : 'Load more pages'}
        </Button>
      ) : (
        <Text textAlign="center" color={ui.textMuted}>
          End of list
        </Text>
      )}
    </YStack>
  )
}

function CompanyPageCard({
  ui,
  page,
  isDesktop,
  onOpen,
  onEdit,
  onDelete,
}: {
  ui: AppUiTokens
  page: CompanyPageWithCounts
  isDesktop: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const location = getCompanyDisplayLocation(page)
  const subtitle = getCompanySubtitle(page)

  return (
    <YStack
      width={isDesktop ? 360 : '100%'}
      flexGrow={isDesktop ? 1 : undefined}
      maxWidth={isDesktop ? 460 : undefined}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      overflow="hidden"
      style={getShadowStyle('sm')}
      cursor="pointer"
      pressStyle={{ opacity: 0.96 }}
      onPress={onOpen}
    >
      <YStack height={140} width="100%" position="relative" backgroundColor={ui.roseSurface}>
        {page.cover_url ? (
          <Image src={page.cover_url} width="100%" height="100%" objectFit="cover" alt={`${page.name} cover`} />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Icons.Image size={24} color={ui.brand} />
          </YStack>
        )}
        <YStack
          position="absolute"
          left={12}
          bottom={-22}
          width={56}
          height={56}
          borderRadius={radius.card}
          borderWidth={2}
          borderColor={ui.surface}
          backgroundColor={ui.surface}
          overflow="hidden"
          style={getShadowStyle('sm')}
        >
          {page.logo_url ? (
            <Image src={page.logo_url} width="100%" height="100%" objectFit="cover" alt={`${page.name} logo`} />
          ) : (
            <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor={ui.surfaceMuted}>
              <Icons.Building2 size={22} color={ui.textMuted} />
            </YStack>
          )}
        </YStack>
      </YStack>

      <YStack padding="$4" paddingTop="$7" gap="$3">
        <YStack gap="$1">
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Text fontWeight="800" fontSize={16} color={ui.text} numberOfLines={1} flex={1}>
              {page.name || 'Untitled page'}
            </Text>
            <Badge tone="neutral" size="sm">
              {page.page_category || 'Company'}
            </Badge>
          </XStack>
          <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
            /{page.page_slug}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
            {subtitle || 'No tagline'}
          </Text>
          {location ? (
            <XStack alignItems="center" gap="$1.5" marginTop="$1">
              <Icons.MapPin size={13} color={ui.textSecondary} />
              <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
                {location}
              </Text>
            </XStack>
          ) : null}
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          <MiniStat ui={ui} icon={Icons.Users} label="Followers" value={page.follower_count ?? 0} />
          <MiniStat ui={ui} icon={Icons.UserCheck} label="Members" value={page.member_count ?? 0} />
          <MiniStat ui={ui} icon={Icons.FileText} label="Posts" value={page.post_count ?? 0} />
        </XStack>

        <XStack
          gap="$2"
          flexWrap="wrap"
          onPress={(event) => {
            // Prevent the card's onPress from also firing when tapping actions.
            event?.stopPropagation?.()
          }}
        >
          <Button flex={1} size="$3" onPress={onOpen} icon={Icons.Eye}>
            View
          </Button>
          <Button size="$3" tone="outline" onPress={onEdit} icon={Icons.Pencil}>
            Edit
          </Button>
          <Button size="$3" tone="destructive" onPress={onDelete} icon={Icons.Trash2}>
            Delete
          </Button>
        </XStack>
      </YStack>
    </YStack>
  )
}

function MiniStat({
  ui,
  icon: Icon,
  label,
  value,
}: {
  ui: AppUiTokens
  icon: (typeof Icons)[keyof typeof Icons]
  label: string
  value: number
}) {
  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      paddingHorizontal="$2.5"
      paddingVertical="$1.5"
      borderRadius={radius.chip}
      backgroundColor={ui.surfaceMuted}
    >
      <Icon size={13} color={ui.textSecondary} />
      <Text fontSize={12} fontWeight="700" color={ui.text}>
        {value}
      </Text>
      <Text fontSize={12} color={ui.textMuted}>
        {label}
      </Text>
    </XStack>
  )
}

// ============================================================================
// CREATE / EDIT FORM
// ============================================================================

function PageFormSheet({
  ui,
  open,
  mode,
  form,
  busy,
  uploadingMedia,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  ui: AppUiTokens
  open: boolean
  mode: FormMode
  form: PageFormState
  busy: boolean
  uploadingMedia: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<PageFormState>) => void
  onSubmit: () => void
}) {
  const canSubmit = !!form.name.trim() && !!form.page_slug.trim() && !!form.industry.trim()

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Create company page' : 'Edit company page'}
      footer={
        <XStack gap="$2" justifyContent="flex-end">
          <Button tone="outline" onPress={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onPress={onSubmit} disabled={busy || !canSubmit}>
            {busy
              ? uploadingMedia
                ? 'Uploading…'
                : 'Saving…'
              : mode === 'create'
                ? 'Create page'
                : 'Save changes'}
          </Button>
        </XStack>
      }
    >
      <YStack gap="$3.5">
        <Field label="Page name" required>
          <Input
            value={form.name}
            onChangeText={(name) =>
              onChange({
                name,
                ...(form.slugTouched ? {} : { page_slug: generateCompanyPageSlug(name) }),
              })
            }
            placeholder="Acme Studio"
          />
        </Field>

        <Field label="Slug" required hint="Lowercase letters, numbers and hyphens.">
          <Input
            value={form.page_slug}
            onChangeText={(page_slug) => onChange({ page_slug, slugTouched: true })}
            placeholder="acme-studio"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Industry" required>
          <Input
            value={form.industry}
            onChangeText={(industry) => onChange({ industry })}
            placeholder="Technology, Fashion, …"
          />
        </Field>

        <Field label="Tagline">
          <TextArea
            value={form.tagline}
            onChangeText={(tagline) => onChange({ tagline })}
            placeholder="Short description of the company"
            numberOfLines={3}
          />
        </Field>

        <MediaField
          ui={ui}
          label="Logo"
          url={form.logoUrl}
          pick={form.logoPick}
          onPick={(logoPick) => onChange({ logoPick })}
          onClear={() => onChange({ logoUrl: '', logoPick: [] })}
          hint="Square logo recommended. Max 5 MB."
        />

        <MediaField
          ui={ui}
          label="Cover image"
          url={form.coverUrl}
          pick={form.coverPick}
          onPick={(coverPick) => onChange({ coverPick })}
          onClear={() => onChange({ coverUrl: '', coverPick: [] })}
          hint="Wide banner for the page header. Max 5 MB."
          tall
        />

        <XStack gap="$3" flexWrap="wrap">
          <Field label="Size" flex={1} minWidth={140}>
            <PickerSelect
              value={form.size}
              options={COMPANY_PAGE_SIZES.map((v) => ({ value: v, label: v }))}
              placeholder="Size"
              onValueChange={(size) => onChange({ size })}
            />
          </Field>
          <Field label="Type" flex={1} minWidth={140}>
            <PickerSelect
              value={form.type}
              options={COMPANY_PAGE_TYPES.map((v) => ({ value: v, label: v }))}
              placeholder="Type"
              onValueChange={(type) => onChange({ type })}
            />
          </Field>
          <Field label="Category" flex={1} minWidth={150}>
            <PickerSelect
              value={form.page_category}
              options={COMPANY_PAGE_CATEGORIES.map((v) => ({ value: v, label: v }))}
              placeholder="Category"
              onValueChange={(page_category) => onChange({ page_category })}
            />
          </Field>
        </XStack>

        <XStack gap="$3" flexWrap="wrap">
          <Field label="Location" flex={1} minWidth={160}>
            <Input
              value={form.location}
              onChangeText={(location) => onChange({ location })}
              placeholder="City / region"
            />
          </Field>
          <Field label="Headquarters" flex={1} minWidth={160}>
            <Input
              value={form.headquarters}
              onChangeText={(headquarters) => onChange({ headquarters })}
              placeholder="HQ city"
            />
          </Field>
        </XStack>

        <XStack gap="$3" flexWrap="wrap">
          <Field label="Website" flex={1.4} minWidth={200}>
            <Input
              value={form.website}
              onChangeText={(website) => onChange({ website })}
              placeholder="https://example.com"
              autoCapitalize="none"
            />
          </Field>
          <Field label="Founded year" flex={1} minWidth={120}>
            <Input
              value={form.founded_year}
              onChangeText={(founded_year) => onChange({ founded_year })}
              placeholder="2020"
              keyboardType="numeric"
            />
          </Field>
        </XStack>
      </YStack>
    </AppBottomSheet>
  )
}

function MediaField({
  ui,
  label,
  url,
  pick,
  onPick,
  onClear,
  hint,
  tall,
}: {
  ui: AppUiTokens
  label: string
  url: string
  pick: PickedImage[]
  onPick: (images: PickedImage[]) => void
  onClear: () => void
  hint: string
  tall?: boolean
}) {
  const showCurrent = !!url && pick.length === 0
  const height = tall ? 140 : 96

  return (
    <YStack gap="$2">
      {showCurrent ? (
        <YStack gap="$2">
          <Text fontSize={13} fontWeight="600" color={ui.text}>
            Current {label.toLowerCase()}
          </Text>
          <YStack
            width={tall ? '100%' : height}
            height={height}
            borderRadius={radius.card}
            overflow="hidden"
            borderWidth={1}
            borderColor={ui.borderSubtle}
            position="relative"
            alignSelf={tall ? undefined : 'flex-start'}
          >
            <Image src={url} width="100%" height="100%" objectFit="cover" alt={label} />
            <YStack
              position="absolute"
              top={8}
              right={8}
              width={32}
              height={32}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(0,0,0,0.6)"
              cursor="pointer"
              onPress={onClear}
              aria-label={`Remove ${label}`}
            >
              <Icons.Trash2 size={16} color="white" />
            </YStack>
          </YStack>
        </YStack>
      ) : null}

      <ImageUploadField
        label={showCurrent ? `Replace ${label.toLowerCase()}` : label}
        hint={hint}
        value={pick}
        onChange={onPick}
        accept="image"
      />
    </YStack>
  )
}

// ============================================================================
// DETAIL
// ============================================================================

function PageDetailSheet({
  ui,
  open,
  isDesktop,
  page,
  loading,
  updatingMember,
  onOpenChange,
  onEdit,
  onDelete,
  onSetMemberRole,
  onRemoveMember,
}: {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  page: CompanyPageDetail | null
  loading: boolean
  updatingMember: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onSetMemberRole: (userId: string, role: 'admin' | 'member') => void
  onRemoveMember: (userId: string) => void
}) {
  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={page?.name ?? 'Company page'}
      footer={
        <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
          <Button tone="outline" icon={Icons.Pencil} onPress={onEdit} disabled={!page}>
            Edit page
          </Button>
          <Button tone="destructive" icon={Icons.Trash2} onPress={onDelete} disabled={!page}>
            Delete
          </Button>
        </XStack>
      }
    >
      {loading && !page ? (
        <YStack minHeight={200} alignItems="center" justifyContent="center" gap="$2">
          <Spinner size="large" />
          <Text color={ui.textMuted}>Loading page…</Text>
        </YStack>
      ) : !page ? (
        <Text color={ui.textMuted}>Page not found.</Text>
      ) : (
        <YStack gap="$4">
          <YStack
            width="100%"
            height={isDesktop ? 200 : 150}
            borderRadius={radius.card}
            overflow="hidden"
            backgroundColor={ui.roseSurface}
            position="relative"
          >
            {page.cover_url ? (
              <Image
                src={page.cover_url}
                width="100%"
                height="100%"
                objectFit="cover"
                alt={`${page.name} cover`}
              />
            ) : (
              <YStack flex={1} alignItems="center" justifyContent="center">
                <Icons.Image size={28} color={ui.brand} />
              </YStack>
            )}
            <YStack
              position="absolute"
              left={14}
              bottom={14}
              width={64}
              height={64}
              borderRadius={radius.card}
              borderWidth={2}
              borderColor="white"
              backgroundColor={ui.surface}
              overflow="hidden"
            >
              {page.logo_url ? (
                <Image
                  src={page.logo_url}
                  width="100%"
                  height="100%"
                  objectFit="cover"
                  alt={`${page.name} logo`}
                />
              ) : (
                <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor={ui.surfaceMuted}>
                  <Icons.Building2 size={24} color={ui.textMuted} />
                </YStack>
              )}
            </YStack>
          </YStack>

          <YStack gap="$1.5">
            <Text fontSize={22} fontWeight="800" color={ui.text}>
              {page.name}
            </Text>
            <Text color={ui.textMuted}>/{page.page_slug}</Text>
            {page.tagline ? (
              <Text color={ui.textSecondary} lineHeight={21}>
                {page.tagline}
              </Text>
            ) : null}
            <XStack gap="$2" flexWrap="wrap" marginTop="$1">
              <Badge tone="brand">{page.page_category}</Badge>
              <Badge tone="neutral">{page.industry}</Badge>
              <Badge tone="info">{page.size}</Badge>
              <Badge tone="neutral">{page.type}</Badge>
            </XStack>
          </YStack>

          <DetailPanel ui={ui} title="Overview" icon={Icons.Info}>
            <DetailRow ui={ui} label="Location" value={getCompanyDisplayLocation(page) || 'Not set'} />
            <DetailRow ui={ui} label="Headquarters" value={page.headquarters || 'Not set'} />
            <DetailRow ui={ui} label="Website" value={page.website || 'Not set'} />
            <DetailRow ui={ui} label="Founded" value={formatFoundedYear(page.founded_year)} />
            <DetailRow ui={ui} label="Created" value={formatDate(page.created_at)} />
            <DetailRow
              ui={ui}
              label="Creator"
              value={
                page.creator?.full_name ||
                page.creator?.username ||
                page.created_by ||
                'Unknown'
              }
            />
          </DetailPanel>

          <DetailPanel ui={ui} title="Engagement" icon={Icons.BarChart3}>
            <XStack gap="$2" flexWrap="wrap">
              <MiniStat ui={ui} icon={Icons.Users} label="Followers" value={page.follower_count} />
              <MiniStat ui={ui} icon={Icons.UserCheck} label="Members" value={page.member_count} />
              <MiniStat ui={ui} icon={Icons.FileText} label="Posts" value={page.post_count} />
              <MiniStat
                ui={ui}
                icon={Icons.Heart}
                label="Reactions"
                value={page.engagement?.total_reactions ?? 0}
              />
              <MiniStat
                ui={ui}
                icon={Icons.MessageCircle}
                label="Comments"
                value={page.engagement?.total_comments ?? 0}
              />
              <MiniStat
                ui={ui}
                icon={Icons.Eye}
                label="Views"
                value={page.engagement?.total_views ?? 0}
              />
            </XStack>
          </DetailPanel>

          <DetailPanel ui={ui} title={`Members (${page.members?.length ?? 0})`} icon={Icons.UserCheck}>
            {!page.members?.length ? (
              <Text color={ui.textMuted}>No members yet.</Text>
            ) : (
              page.members.map((member) => (
                <XStack
                  key={member.id}
                  gap="$3"
                  padding="$3"
                  borderRadius={radius.chip}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  alignItems="center"
                >
                  {member.avatar_url ? (
                    <Image
                      src={member.avatar_url}
                      width={40}
                      height={40}
                      borderRadius={999}
                      alt={member.full_name || 'Member'}
                    />
                  ) : (
                    <YStack
                      width={40}
                      height={40}
                      borderRadius={999}
                      backgroundColor={ui.surfaceMuted}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Icons.User size={18} color={ui.textMuted} />
                    </YStack>
                  )}
                  <YStack flex={1} minWidth={0} gap="$1">
                    <Text fontWeight="700" color={ui.text} numberOfLines={1}>
                      {member.full_name || member.username || 'Member'}
                    </Text>
                    <Badge
                      tone={member.role === 'owner' ? 'brand' : member.role === 'admin' ? 'success' : 'neutral'}
                      size="sm"
                    >
                      {formatCompanyMemberRole(member.role)}
                    </Badge>
                  </YStack>
                  {member.role !== 'owner' ? (
                    <XStack gap="$1.5" flexWrap="wrap">
                      {member.role !== 'admin' ? (
                        <Button
                          size="$2.5"
                          tone="outline"
                          disabled={updatingMember}
                          onPress={() => onSetMemberRole(member.user_id, 'admin')}
                        >
                          Make admin
                        </Button>
                      ) : (
                        <Button
                          size="$2.5"
                          tone="outline"
                          disabled={updatingMember}
                          onPress={() => onSetMemberRole(member.user_id, 'member')}
                        >
                          Make member
                        </Button>
                      )}
                      <Button
                        size="$2.5"
                        tone="destructive"
                        disabled={updatingMember}
                        onPress={() => onRemoveMember(member.user_id)}
                      >
                        Remove
                      </Button>
                    </XStack>
                  ) : null}
                </XStack>
              ))
            )}
          </DetailPanel>

          <DetailPanel
            ui={ui}
            title={`Recent followers (${page.recent_followers?.length ?? 0})`}
            icon={Icons.Users}
          >
            {!page.recent_followers?.length ? (
              <Text color={ui.textMuted}>No followers yet.</Text>
            ) : (
              page.recent_followers.map((follower) => (
                <XStack key={follower.id} gap="$3" alignItems="center">
                  {follower.avatar_url ? (
                    <Image
                      src={follower.avatar_url}
                      width={36}
                      height={36}
                      borderRadius={999}
                      alt={follower.full_name || 'Follower'}
                    />
                  ) : (
                    <YStack
                      width={36}
                      height={36}
                      borderRadius={999}
                      backgroundColor={ui.surfaceMuted}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Icons.User size={16} color={ui.textMuted} />
                    </YStack>
                  )}
                  <YStack flex={1} minWidth={0}>
                    <Text fontWeight="600" color={ui.text} numberOfLines={1}>
                      {follower.full_name || follower.username || 'Follower'}
                    </Text>
                    <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                      {follower.headline || 'No headline'}
                    </Text>
                  </YStack>
                </XStack>
              ))
            )}
          </DetailPanel>
        </YStack>
      )}
    </AppBottomSheet>
  )
}

// ============================================================================
// DELETE CONFIRM
// ============================================================================

function ConfirmDeleteSheet({
  ui,
  page,
  busy,
  onCancel,
  onConfirm,
}: {
  ui: AppUiTokens
  page: CompanyPageWithCounts | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AppBottomSheet
      open={!!page}
      onOpenChange={(open) => (!open ? onCancel() : undefined)}
      title="Delete company page?"
      scrollable={false}
      footer={
        <XStack gap="$2" justifyContent="flex-end">
          <Button tone="outline" onPress={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button tone="destructive" onPress={onConfirm} disabled={busy} icon={Icons.Trash2}>
            {busy ? 'Deleting…' : 'Delete page'}
          </Button>
        </XStack>
      }
    >
      <YStack gap="$2">
        <Text color={ui.text} fontWeight="700" fontSize={16}>
          {page?.name}
        </Text>
        <Text color={ui.textSecondary} lineHeight={21}>
          This permanently removes the company page. Related members and followers may also be
          affected. This action cannot be undone.
        </Text>
      </YStack>
    </AppBottomSheet>
  )
}

// ============================================================================
// SHARED
// ============================================================================

function DetailPanel({
  ui,
  title,
  icon: Icon,
  children,
}: {
  ui: AppUiTokens
  title: string
  icon: (typeof Icons)[keyof typeof Icons]
  children: ReactNode
}) {
  return (
    <YStack
      gap="$2.5"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <XStack alignItems="center" gap="$2">
        <Icon size={16} color={ui.brand} />
        <Text fontWeight="800" color={ui.text}>
          {title}
        </Text>
      </XStack>
      <YStack gap="$2.5">{children}</YStack>
    </YStack>
  )
}

/** Key/value row — or a titled panel when `title` + `children` are provided. */
function DetailRow({
  ui,
  label,
  value,
  title,
  icon,
  children,
}: {
  ui: AppUiTokens
  label?: string
  value?: string
  title?: string
  icon?: (typeof Icons)[keyof typeof Icons]
  children?: ReactNode
}) {
  if (title && icon && children !== undefined) {
    return (
      <DetailPanel ui={ui} title={title} icon={icon}>
        {children}
      </DetailPanel>
    )
  }

  return (
    <XStack gap="$3" justifyContent="space-between" alignItems="flex-start">
      <Text flex={1} color={ui.textMuted} fontSize={13}>
        {label}
      </Text>
      <Text flex={1.4} color={ui.text} fontSize={13} fontWeight="600" textAlign="right">
        {value ?? ''}
      </Text>
    </XStack>
  )
}
