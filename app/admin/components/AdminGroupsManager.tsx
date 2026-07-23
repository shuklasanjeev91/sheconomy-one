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
  Switch,
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
  DEFAULT_GROUP_LIMIT,
  DEFAULT_GROUP_TYPE,
  GROUP_TYPE_OPTIONS,
  clearCurrentGroup,
  createGroup,
  deleteGroup,
  deleteGroupAvatar,
  deleteGroupCover,
  formatGroupMemberRole,
  formatGroupType,
  formatIndustriesLabel,
  getGroupSubtitle,
  isGroupStorageUrl,
  loadGroupDetail,
  loadGroupFacets,
  loadGroupPlatformStats,
  loadGroups,
  removeGroupMember,
  respondToGroupJoinRequest,
  setGroupMemberRole,
  updateGroup,
  uploadGroupAvatar,
  uploadGroupCover,
  validateGroupImageFile,
  type GroupDetail,
  type GroupPlatformStats,
  type GroupWithCounts,
} from '~/lib/group'

// ============================================================================
// TYPES
// ============================================================================

type FormMode = 'create' | 'edit'

type GroupFormState = {
  name: string
  title: string
  description: string
  location: string
  industries: string
  rules: string
  group_type: string
  allow_invites: boolean
  require_post_review: boolean
  avatarUrl: string
  coverUrl: string
  avatarPick: PickedImage[]
  coverPick: PickedImage[]
}

const EMPTY_FORM: GroupFormState = {
  name: '',
  title: '',
  description: '',
  location: '',
  industries: '',
  rules: '',
  group_type: DEFAULT_GROUP_TYPE,
  allow_invites: true,
  require_post_review: false,
  avatarUrl: '',
  coverUrl: '',
  avatarPick: [],
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

function groupTypeTone(type: string | null | undefined): 'success' | 'warning' | 'neutral' {
  if (type === 'private') return 'warning'
  if (type === 'secret') return 'neutral'
  return 'success'
}

// ============================================================================
// MAIN
// ============================================================================

export function AdminGroupsManager() {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

  const {
    groups,
    totalGroups,
    hasMore,
    currentGroup,
    facets,
    platformStats,
    isLoadingList,
    isLoadingDetail,
    isSaving,
    isDeleting,
    isUpdatingMember,
    isRespondingJoinRequest,
    error,
  } = useAppSelector((state) => state.group)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [industryFilter, setIndustryFilter] = useState('all')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [originalAvatar, setOriginalAvatar] = useState<string | null>(null)
  const [originalCover, setOriginalCover] = useState<string | null>(null)
  const [form, setForm] = useState<GroupFormState>(EMPTY_FORM)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<GroupWithCounts | null>(null)

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      group_type: typeFilter === 'all' ? undefined : typeFilter,
      location: locationFilter === 'all' ? undefined : locationFilter,
      industry: industryFilter === 'all' ? undefined : industryFilter,
    }),
    [search, typeFilter, locationFilter, industryFilter],
  )

  useEffect(() => {
    dispatch(loadGroupPlatformStats())
    dispatch(loadGroupFacets())
  }, [dispatch])

  useEffect(() => {
    dispatch(loadGroups({ filters, limit: DEFAULT_GROUP_LIMIT, offset: 0 }))
  }, [dispatch, filters])

  const patchForm = useCallback((patch: Partial<GroupFormState>) => {
    setForm((current) => ({ ...current, ...patch }))
  }, [])

  function openCreateForm() {
    setFormMode('create')
    setEditingId(null)
    setOriginalAvatar(null)
    setOriginalCover(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEditForm(group: GroupWithCounts | GroupDetail) {
    setFormMode('edit')
    setEditingId(group.id)
    setOriginalAvatar(group.avatar_url ?? null)
    setOriginalCover(group.cover_url ?? null)
    setForm({
      name: group.name ?? '',
      title: group.title ?? '',
      description: group.description ?? '',
      location: group.location ?? '',
      industries: (group.industries ?? []).join(', '),
      rules: group.rules ?? '',
      group_type: group.group_type || DEFAULT_GROUP_TYPE,
      allow_invites: group.allow_invites ?? true,
      require_post_review: group.require_post_review ?? false,
      avatarUrl: group.avatar_url ?? '',
      coverUrl: group.cover_url ?? '',
      avatarPick: [],
      coverPick: [],
    })
    setFormOpen(true)
  }

  async function uploadPickedImage(
    picked: PickedImage,
    kind: 'avatar' | 'cover',
    groupId?: string | null,
  ): Promise<string | null> {
    const blob = await pickedImageToBlob(picked)
    const fileArg = {
      blob,
      mimeType: picked.mimeType || blob.type || 'image/jpeg',
      fileName: picked.fileName || `${kind}-${Date.now()}.jpg`,
      fileSize: picked.file?.size ?? blob.size,
    }
    const check = validateGroupImageFile(fileArg)
    if (!check.valid) {
      toast.show('Invalid image', { tone: 'danger', message: check.error })
      return null
    }
    const res =
      kind === 'avatar'
        ? await uploadGroupAvatar(fileArg, groupId ?? undefined)
        : await uploadGroupCover(fileArg, groupId ?? undefined)
    if (!res.success || !res.data) {
      toast.show(`${kind === 'avatar' ? 'Avatar' : 'Cover'} upload failed`, {
        tone: 'danger',
        message: res.error ?? undefined,
      })
      return null
    }
    return res.data.url
  }

  async function submitGroup() {
    if (!form.name.trim() || !form.title.trim()) {
      toast.show('Missing required fields', {
        tone: 'danger',
        message: 'Name and title are required.',
      })
      return
    }

    let avatarUrl: string | null = form.avatarUrl.trim() || null
    let coverUrl: string | null = form.coverUrl.trim() || null

    try {
      setUploadingMedia(true)
      if (form.avatarPick[0]) {
        const url = await uploadPickedImage(form.avatarPick[0], 'avatar', editingId)
        if (!url) {
          setUploadingMedia(false)
          return
        }
        avatarUrl = url
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

      const payload = {
        name: form.name.trim(),
        title: form.title.trim(),
        description: nullableText(form.description),
        location: nullableText(form.location),
        industries: form.industries.trim() || null,
        rules: nullableText(form.rules),
        group_type: form.group_type || DEFAULT_GROUP_TYPE,
        allow_invites: form.allow_invites,
        require_post_review: form.require_post_review,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
      }

      if (formMode === 'create') {
        await dispatch(createGroup(payload)).unwrap()
        toast.show('Group created', {
          tone: 'success',
          message: `"${payload.title}" is ready.`,
        })
      } else if (editingId) {
        await dispatch(updateGroup({ groupId: editingId, payload })).unwrap()
        toast.show('Group updated', { tone: 'success', message: 'Your changes were saved.' })
        if (isGroupStorageUrl(originalAvatar) && originalAvatar !== avatarUrl) {
          void deleteGroupAvatar(originalAvatar)
        }
        if (isGroupStorageUrl(originalCover) && originalCover !== coverUrl) {
          void deleteGroupCover(originalCover)
        }
        if (detailOpen) dispatch(loadGroupDetail(editingId))
      }
      setFormOpen(false)
      dispatch(loadGroupPlatformStats())
      dispatch(loadGroupFacets())
    } catch (message) {
      setUploadingMedia(false)
      toast.show('Could not save group', { tone: 'danger', message: String(message) })
    }
  }

  function openDetail(groupId: string) {
    setDetailOpen(true)
    dispatch(loadGroupDetail(groupId))
  }

  function closeDetail() {
    setDetailOpen(false)
    dispatch(clearCurrentGroup())
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await dispatch(deleteGroup(target.id)).unwrap()
      toast.show('Group deleted', {
        tone: 'success',
        message: `"${target.title || target.name}" was removed.`,
      })
      if (isGroupStorageUrl(target.avatar_url)) void deleteGroupAvatar(target.avatar_url)
      if (isGroupStorageUrl(target.cover_url)) void deleteGroupCover(target.cover_url)
      setDeleteTarget(null)
      dispatch(loadGroupPlatformStats())
    } catch (message) {
      toast.show('Could not delete group', { tone: 'danger', message: String(message) })
    }
  }

  function loadMore() {
    dispatch(
      loadGroups({
        filters,
        limit: DEFAULT_GROUP_LIMIT,
        offset: groups.length,
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
      <GroupsHeader
        ui={ui}
        stats={platformStats}
        total={totalGroups}
        onCreate={openCreateForm}
        onRefresh={() => {
          dispatch(loadGroups({ filters, limit: DEFAULT_GROUP_LIMIT, offset: 0 }))
          dispatch(loadGroupPlatformStats())
          dispatch(loadGroupFacets())
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

      <GroupFilters
        ui={ui}
        search={search}
        typeFilter={typeFilter}
        locationFilter={locationFilter}
        industryFilter={industryFilter}
        facets={facets}
        onSearchChange={setSearch}
        onTypeChange={setTypeFilter}
        onLocationChange={setLocationFilter}
        onIndustryChange={setIndustryFilter}
      />

      <GroupList
        ui={ui}
        groups={groups}
        total={totalGroups}
        loading={isLoadingList}
        hasMore={hasMore}
        isDesktop={isDesktop}
        onOpen={openDetail}
        onEdit={openEditForm}
        onDelete={setDeleteTarget}
        onLoadMore={loadMore}
      />

      <GroupFormSheet
        ui={ui}
        open={formOpen}
        mode={formMode}
        form={form}
        busy={busy}
        uploadingMedia={uploadingMedia}
        onOpenChange={setFormOpen}
        onChange={patchForm}
        onSubmit={submitGroup}
      />

      <GroupDetailSheet
        ui={ui}
        open={detailOpen}
        isDesktop={isDesktop}
        group={currentGroup}
        loading={isLoadingDetail}
        updatingMember={isUpdatingMember}
        respondingRequest={isRespondingJoinRequest}
        onOpenChange={(open) => (open ? setDetailOpen(true) : closeDetail())}
        onEdit={() => {
          if (!currentGroup) return
          setDetailOpen(false)
          openEditForm(currentGroup)
        }}
        onDelete={() => {
          if (!currentGroup) return
          setDetailOpen(false)
          setDeleteTarget(currentGroup)
        }}
        onSetMemberRole={async (userId, role) => {
          if (!currentGroup) return
          try {
            await dispatch(
              setGroupMemberRole({ groupId: currentGroup.id, userId, role }),
            ).unwrap()
            toast.show('Member updated', { tone: 'success' })
          } catch (message) {
            toast.show('Could not update member', { tone: 'danger', message: String(message) })
          }
        }}
        onRemoveMember={async (userId) => {
          if (!currentGroup) return
          try {
            await dispatch(removeGroupMember({ groupId: currentGroup.id, userId })).unwrap()
            toast.show('Member removed', { tone: 'success' })
            dispatch(loadGroupDetail(currentGroup.id))
          } catch (message) {
            toast.show('Could not remove member', { tone: 'danger', message: String(message) })
          }
        }}
        onRespondJoinRequest={async (requestId, approve) => {
          if (!currentGroup) return
          try {
            await dispatch(
              respondToGroupJoinRequest({
                groupId: currentGroup.id,
                requestId,
                approve,
              }),
            ).unwrap()
            toast.show(approve ? 'Request approved' : 'Request rejected', { tone: 'success' })
            dispatch(loadGroupDetail(currentGroup.id))
            dispatch(loadGroupPlatformStats())
          } catch (message) {
            toast.show('Could not respond to request', {
              tone: 'danger',
              message: String(message),
            })
          }
        }}
      />

      <ConfirmDeleteSheet
        ui={ui}
        group={deleteTarget}
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

function GroupsHeader({
  ui,
  stats,
  total,
  onCreate,
  onRefresh,
}: {
  ui: AppUiTokens
  stats: GroupPlatformStats | null
  total: number
  onCreate: () => void
  onRefresh: () => void
}) {
  const cards = [
    {
      label: 'Total groups',
      value: stats?.totalGroups ?? total,
      tone: 'info' as const,
      icon: Icons.Users,
    },
    {
      label: 'This month',
      value: stats?.groupsThisMonth ?? 0,
      tone: 'brand' as const,
      icon: Icons.Calendar,
    },
    {
      label: 'Public',
      value: stats?.publicGroups ?? 0,
      tone: 'success' as const,
      icon: Icons.Globe,
    },
    {
      label: 'Private',
      value: stats?.privateGroups ?? 0,
      tone: 'warning' as const,
      icon: Icons.Lock,
    },
    {
      label: 'Members',
      value: stats?.totalMembers ?? 0,
      tone: 'neutral' as const,
      icon: Icons.UserCheck,
    },
    {
      label: 'Pending joins',
      value: stats?.pendingJoinRequests ?? 0,
      tone: 'danger' as const,
      icon: Icons.UserPlus,
    },
  ]

  return (
    <YStack gap="$3.5">
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minWidth={220}>
          <Text fontSize={26} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
            Groups
          </Text>
          <Text color={ui.textSecondary}>
            Create and moderate community groups — members, join requests, and posting rules.
          </Text>
        </YStack>
        <XStack gap="$2">
          <Button tone="outline" icon={Icons.RefreshCw} onPress={onRefresh}>
            Refresh
          </Button>
          <Button icon={Icons.Plus} onPress={onCreate}>
            Create group
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
              minWidth={140}
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

function GroupFilters({
  ui,
  search,
  typeFilter,
  locationFilter,
  industryFilter,
  facets,
  onSearchChange,
  onTypeChange,
  onLocationChange,
  onIndustryChange,
}: {
  ui: AppUiTokens
  search: string
  typeFilter: string
  locationFilter: string
  industryFilter: string
  facets: {
    locations: string[]
    industries: string[]
    groupTypes: string[]
  } | null
  onSearchChange: (v: string) => void
  onTypeChange: (v: string) => void
  onLocationChange: (v: string) => void
  onIndustryChange: (v: string) => void
}) {
  const types = facets?.groupTypes?.length ? facets.groupTypes : [...GROUP_TYPE_OPTIONS]
  const locations = facets?.locations ?? []
  const industries = facets?.industries ?? []

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
            placeholder="Search by name, title, description, or location"
          />
        </Field>
        <Field label="Type" flex={1} minWidth={140}>
          <PickerSelect
            value={typeFilter}
            options={[
              { value: 'all', label: 'All types' },
              ...types.map((v) => ({ value: v, label: formatGroupType(v) })),
            ]}
            placeholder="Type"
            onValueChange={onTypeChange}
          />
        </Field>
        <Field label="Location" flex={1} minWidth={150}>
          <PickerSelect
            value={locationFilter}
            options={[
              { value: 'all', label: 'All locations' },
              ...locations.map((v) => ({ value: v, label: v })),
            ]}
            placeholder="Location"
            onValueChange={onLocationChange}
          />
        </Field>
        <Field label="Industry" flex={1} minWidth={150}>
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

function GroupList({
  ui,
  groups,
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
  groups: GroupWithCounts[]
  total: number
  loading: boolean
  hasMore: boolean
  isDesktop: boolean
  onOpen: (id: string) => void
  onEdit: (group: GroupWithCounts) => void
  onDelete: (group: GroupWithCounts) => void
  onLoadMore: () => void
}) {
  if (loading && groups.length === 0) {
    return (
      <YStack minHeight={260} alignItems="center" justifyContent="center" gap="$2">
        <Spinner size="large" />
        <Text color={ui.textMuted}>Loading groups…</Text>
      </YStack>
    )
  }

  if (!groups.length) {
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
          <Icons.Users size={26} color={ui.textMuted} />
        </YStack>
        <Text fontWeight="800" color={ui.text}>
          No groups found
        </Text>
        <Text color={ui.textMuted} textAlign="center">
          Create your first group or adjust the filters above.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="800" color={ui.text}>
          All groups
        </Text>
        <Text color={ui.textMuted}>
          {groups.length} of {total}
        </Text>
      </XStack>

      <XStack flexWrap="wrap" gap="$3.5">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            ui={ui}
            group={group}
            isDesktop={isDesktop}
            onOpen={() => onOpen(group.id)}
            onEdit={() => onEdit(group)}
            onDelete={() => onDelete(group)}
          />
        ))}
      </XStack>

      {hasMore ? (
        <Button tone="outline" onPress={onLoadMore} disabled={loading}>
          {loading ? 'Loading…' : 'Load more groups'}
        </Button>
      ) : (
        <Text textAlign="center" color={ui.textMuted}>
          End of list
        </Text>
      )}
    </YStack>
  )
}

function GroupCard({
  ui,
  group,
  isDesktop,
  onOpen,
  onEdit,
  onDelete,
}: {
  ui: AppUiTokens
  group: GroupWithCounts
  isDesktop: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const subtitle = getGroupSubtitle(group)

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
        {group.cover_url ? (
          <Image
            src={group.cover_url}
            width="100%"
            height="100%"
            objectFit="cover"
            alt={`${group.title} cover`}
          />
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
          borderRadius={999}
          borderWidth={2}
          borderColor={ui.surface}
          backgroundColor={ui.surface}
          overflow="hidden"
          style={getShadowStyle('sm')}
        >
          {group.avatar_url ? (
            <Image
              src={group.avatar_url}
              width="100%"
              height="100%"
              objectFit="cover"
              alt={`${group.title} avatar`}
            />
          ) : (
            <YStack
              flex={1}
              alignItems="center"
              justifyContent="center"
              backgroundColor={ui.surfaceMuted}
            >
              <Icons.Users size={22} color={ui.textMuted} />
            </YStack>
          )}
        </YStack>
      </YStack>

      <YStack padding="$4" paddingTop="$7" gap="$3">
        <YStack gap="$1">
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Text fontWeight="800" fontSize={16} color={ui.text} numberOfLines={1} flex={1}>
              {group.title || group.name || 'Untitled group'}
            </Text>
            <Badge tone={groupTypeTone(group.group_type)} size="sm">
              {formatGroupType(group.group_type)}
            </Badge>
          </XStack>
          <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
            {group.name}
          </Text>
          <Text fontSize={13} color={ui.textSecondary} numberOfLines={2}>
            {subtitle || 'No description'}
          </Text>
          {group.location ? (
            <XStack alignItems="center" gap="$1.5" marginTop="$1">
              <Icons.MapPin size={13} color={ui.textSecondary} />
              <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
                {group.location}
              </Text>
            </XStack>
          ) : null}
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          <MiniStat ui={ui} icon={Icons.Users} label="Members" value={group.member_count ?? 0} />
          <MiniStat ui={ui} icon={Icons.FileText} label="Posts" value={group.post_count ?? 0} />
          <MiniStat
            ui={ui}
            icon={Icons.UserPlus}
            label="Pending"
            value={group.pending_request_count ?? 0}
          />
        </XStack>

        <XStack
          gap="$2"
          flexWrap="wrap"
          onPress={(event) => {
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

function GroupFormSheet({
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
  form: GroupFormState
  busy: boolean
  uploadingMedia: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<GroupFormState>) => void
  onSubmit: () => void
}) {
  const canSubmit = !!form.name.trim() && !!form.title.trim()

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Create group' : 'Edit group'}
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
                ? 'Create group'
                : 'Save changes'}
          </Button>
        </XStack>
      }
    >
      <YStack gap="$3.5">
        <Field label="Name" required hint="Short label (max 100 characters).">
          <Input
            value={form.name}
            onChangeText={(name) => onChange({ name })}
            placeholder="founders-circle"
          />
        </Field>

        <Field label="Title" required>
          <Input
            value={form.title}
            onChangeText={(title) => onChange({ title })}
            placeholder="Founders Circle"
          />
        </Field>

        <Field label="Description">
          <TextArea
            value={form.description}
            onChangeText={(description) => onChange({ description })}
            placeholder="What is this group about?"
            numberOfLines={4}
          />
        </Field>

        <MediaField
          ui={ui}
          label="Avatar"
          url={form.avatarUrl}
          pick={form.avatarPick}
          onPick={(avatarPick) => onChange({ avatarPick })}
          onClear={() => onChange({ avatarUrl: '', avatarPick: [] })}
          hint="Square avatar recommended. Max 5 MB."
        />

        <MediaField
          ui={ui}
          label="Cover image"
          url={form.coverUrl}
          pick={form.coverPick}
          onPick={(coverPick) => onChange({ coverPick })}
          onClear={() => onChange({ coverUrl: '', coverPick: [] })}
          hint="Wide banner for the group header. Max 5 MB."
          tall
        />

        <XStack gap="$3" flexWrap="wrap">
          <Field label="Type" flex={1} minWidth={140}>
            <PickerSelect
              value={form.group_type}
              options={GROUP_TYPE_OPTIONS.map((v) => ({
                value: v,
                label: formatGroupType(v),
              }))}
              placeholder="Type"
              onValueChange={(group_type) => onChange({ group_type })}
            />
          </Field>
          <Field label="Location" flex={1} minWidth={160}>
            <Input
              value={form.location}
              onChangeText={(location) => onChange({ location })}
              placeholder="City / region"
            />
          </Field>
        </XStack>

        <Field label="Industries" hint="Comma-separated list.">
          <Input
            value={form.industries}
            onChangeText={(industries) => onChange({ industries })}
            placeholder="Technology, Fashion, …"
          />
        </Field>

        <Field label="Rules">
          <TextArea
            value={form.rules}
            onChangeText={(rules) => onChange({ rules })}
            placeholder="Community guidelines for this group"
            numberOfLines={4}
          />
        </Field>

        <YStack
          gap="$3"
          padding="$3.5"
          borderRadius={radius.card}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
        >
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <YStack flex={1} gap="$0.5">
              <Text fontWeight="700" color={ui.text}>
                Allow invites
              </Text>
              <Text fontSize={12} color={ui.textMuted}>
                Members can invite others to the group.
              </Text>
            </YStack>
            <Switch
              checked={form.allow_invites}
              onCheckedChange={(allow_invites) => onChange({ allow_invites })}
            />
          </XStack>
          <XStack alignItems="center" justifyContent="space-between" gap="$3">
            <YStack flex={1} gap="$0.5">
              <Text fontWeight="700" color={ui.text}>
                Require post review
              </Text>
              <Text fontSize={12} color={ui.textMuted}>
                New posts need admin approval before publishing.
              </Text>
            </YStack>
            <Switch
              checked={form.require_post_review}
              onCheckedChange={(require_post_review) => onChange({ require_post_review })}
            />
          </XStack>
        </YStack>
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
            borderRadius={tall ? radius.card : 999}
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

function GroupDetailSheet({
  ui,
  open,
  isDesktop,
  group,
  loading,
  updatingMember,
  respondingRequest,
  onOpenChange,
  onEdit,
  onDelete,
  onSetMemberRole,
  onRemoveMember,
  onRespondJoinRequest,
}: {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  group: GroupDetail | null
  loading: boolean
  updatingMember: boolean
  respondingRequest: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onSetMemberRole: (userId: string, role: 'admin' | 'member') => void
  onRemoveMember: (userId: string) => void
  onRespondJoinRequest: (requestId: string, approve: boolean) => void
}) {
  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={group?.title ?? group?.name ?? 'Group'}
      footer={
        <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
          <Button tone="outline" icon={Icons.Pencil} onPress={onEdit} disabled={!group}>
            Edit group
          </Button>
          <Button tone="destructive" icon={Icons.Trash2} onPress={onDelete} disabled={!group}>
            Delete
          </Button>
        </XStack>
      }
    >
      {loading && !group ? (
        <YStack minHeight={200} alignItems="center" justifyContent="center" gap="$2">
          <Spinner size="large" />
          <Text color={ui.textMuted}>Loading group…</Text>
        </YStack>
      ) : !group ? (
        <Text color={ui.textMuted}>Group not found.</Text>
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
            {group.cover_url ? (
              <Image
                src={group.cover_url}
                width="100%"
                height="100%"
                objectFit="cover"
                alt={`${group.title} cover`}
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
              borderRadius={999}
              borderWidth={2}
              borderColor="white"
              backgroundColor={ui.surface}
              overflow="hidden"
            >
              {group.avatar_url ? (
                <Image
                  src={group.avatar_url}
                  width="100%"
                  height="100%"
                  objectFit="cover"
                  alt={`${group.title} avatar`}
                />
              ) : (
                <YStack
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={ui.surfaceMuted}
                >
                  <Icons.Users size={24} color={ui.textMuted} />
                </YStack>
              )}
            </YStack>
          </YStack>

          <YStack gap="$1.5">
            <Text fontSize={22} fontWeight="800" color={ui.text}>
              {group.title}
            </Text>
            <Text color={ui.textMuted}>{group.name}</Text>
            {group.description ? (
              <Text color={ui.textSecondary} lineHeight={21}>
                {group.description}
              </Text>
            ) : null}
            <XStack gap="$2" flexWrap="wrap" marginTop="$1">
              <Badge tone={groupTypeTone(group.group_type)}>
                {formatGroupType(group.group_type)}
              </Badge>
              {group.location ? <Badge tone="neutral">{group.location}</Badge> : null}
              {group.require_post_review ? <Badge tone="warning">Post review</Badge> : null}
              {group.allow_invites === false ? (
                <Badge tone="neutral">Invites off</Badge>
              ) : null}
            </XStack>
          </YStack>

          <DetailPanel ui={ui} title="Overview" icon={Icons.Info}>
            <DetailRow
              ui={ui}
              label="Industries"
              value={formatIndustriesLabel(group.industries)}
            />
            <DetailRow ui={ui} label="Location" value={group.location || 'Not set'} />
            <DetailRow ui={ui} label="Created" value={formatDate(group.created_at)} />
            <DetailRow ui={ui} label="Updated" value={formatDate(group.updated_at)} />
            <DetailRow
              ui={ui}
              label="Creator"
              value={
                group.creator?.full_name ||
                group.creator?.username ||
                group.created_by ||
                'Unknown'
              }
            />
            <DetailRow
              ui={ui}
              label="Allow invites"
              value={group.allow_invites ? 'Yes' : 'No'}
            />
            <DetailRow
              ui={ui}
              label="Require post review"
              value={group.require_post_review ? 'Yes' : 'No'}
            />
          </DetailPanel>

          {group.rules ? (
            <DetailPanel ui={ui} title="Rules" icon={Icons.FileText}>
              <Text color={ui.textSecondary} lineHeight={21}>
                {group.rules}
              </Text>
            </DetailPanel>
          ) : null}

          <DetailPanel ui={ui} title="Engagement" icon={Icons.BarChart3}>
            <XStack gap="$2" flexWrap="wrap">
              <MiniStat ui={ui} icon={Icons.Users} label="Members" value={group.member_count} />
              <MiniStat ui={ui} icon={Icons.FileText} label="Posts" value={group.post_count} />
              <MiniStat
                ui={ui}
                icon={Icons.UserPlus}
                label="Pending"
                value={group.pending_request_count}
              />
              <MiniStat
                ui={ui}
                icon={Icons.Heart}
                label="Reactions"
                value={group.engagement?.total_reactions ?? 0}
              />
              <MiniStat
                ui={ui}
                icon={Icons.MessageCircle}
                label="Comments"
                value={group.engagement?.total_comments ?? 0}
              />
              <MiniStat
                ui={ui}
                icon={Icons.Eye}
                label="Views"
                value={group.engagement?.total_views ?? 0}
              />
            </XStack>
          </DetailPanel>

          <DetailPanel
            ui={ui}
            title={`Members (${group.members?.length ?? 0})`}
            icon={Icons.UserCheck}
          >
            {!group.members?.length ? (
              <Text color={ui.textMuted}>No members yet.</Text>
            ) : (
              group.members.map((member) => {
                const isCreator = group.created_by === member.user_id
                return (
                  <XStack
                    key={member.id}
                    gap="$3"
                    padding="$3"
                    borderRadius={radius.chip}
                    borderWidth={1}
                    borderColor={ui.borderSubtle}
                    alignItems="center"
                    flexWrap="wrap"
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
                    <YStack flex={1} minWidth={120} gap="$1">
                      <Text fontWeight="700" color={ui.text} numberOfLines={1}>
                        {member.full_name || member.username || 'Member'}
                        {isCreator ? ' · Creator' : ''}
                      </Text>
                      <Badge
                        tone={member.role === 'admin' ? 'success' : 'neutral'}
                        size="sm"
                      >
                        {formatGroupMemberRole(member.role)}
                      </Badge>
                    </YStack>
                    {!isCreator ? (
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
                )
              })
            )}
          </DetailPanel>

          <DetailPanel
            ui={ui}
            title={`Join requests (${group.join_requests?.length ?? 0})`}
            icon={Icons.UserPlus}
          >
            {!group.join_requests?.length ? (
              <Text color={ui.textMuted}>No pending join requests.</Text>
            ) : (
              group.join_requests.map((request) => (
                <XStack
                  key={request.id}
                  gap="$3"
                  padding="$3"
                  borderRadius={radius.chip}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  alignItems="center"
                  flexWrap="wrap"
                >
                  {request.avatar_url ? (
                    <Image
                      src={request.avatar_url}
                      width={40}
                      height={40}
                      borderRadius={999}
                      alt={request.full_name || 'Requester'}
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
                  <YStack flex={1} minWidth={120} gap="$0.5">
                    <Text fontWeight="700" color={ui.text} numberOfLines={1}>
                      {request.full_name || request.username || 'Member'}
                    </Text>
                    <Text fontSize={12} color={ui.textMuted}>
                      {request.headline || formatDate(request.requested_at)}
                    </Text>
                  </YStack>
                  <XStack gap="$1.5">
                    <Button
                      size="$2.5"
                      disabled={respondingRequest}
                      onPress={() => onRespondJoinRequest(request.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="$2.5"
                      tone="outline"
                      disabled={respondingRequest}
                      onPress={() => onRespondJoinRequest(request.id, false)}
                    >
                      Reject
                    </Button>
                  </XStack>
                </XStack>
              ))
            )}
          </DetailPanel>

          <DetailPanel
            ui={ui}
            title={`Invitations (${group.invitations?.length ?? 0})`}
            icon={Icons.Mail}
          >
            {!group.invitations?.length ? (
              <Text color={ui.textMuted}>No invitations yet.</Text>
            ) : (
              group.invitations.map((invite) => (
                <XStack key={invite.id} gap="$3" alignItems="center">
                  {invite.invitee_avatar_url ? (
                    <Image
                      src={invite.invitee_avatar_url}
                      width={36}
                      height={36}
                      borderRadius={999}
                      alt={invite.invitee_full_name || 'Invitee'}
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
                      {invite.invitee_full_name ||
                        invite.invitee_username ||
                        invite.invited_user_id ||
                        'Invitee'}
                    </Text>
                    <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                      {invite.status || 'pending'} · {formatDate(invite.created_at)}
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
  group,
  busy,
  onCancel,
  onConfirm,
}: {
  ui: AppUiTokens
  group: GroupWithCounts | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AppBottomSheet
      open={!!group}
      onOpenChange={(open) => (!open ? onCancel() : undefined)}
      title="Delete group?"
      scrollable={false}
      footer={
        <XStack gap="$2" justifyContent="flex-end">
          <Button tone="outline" onPress={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button tone="destructive" onPress={onConfirm} disabled={busy} icon={Icons.Trash2}>
            {busy ? 'Deleting…' : 'Delete group'}
          </Button>
        </XStack>
      }
    >
      <YStack gap="$2">
        <Text color={ui.text} fontWeight="700" fontSize={16}>
          {group?.title || group?.name}
        </Text>
        <Text color={ui.textSecondary} lineHeight={21}>
          This permanently removes the group. Related members, join requests, and invitations may
          also be affected. This action cannot be undone.
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
