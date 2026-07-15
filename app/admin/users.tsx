import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'one'

import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
  Icons,
  Image,
  Input,
  ScrollView,
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
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { commerceRoutes } from '~/lib/routes'
import { supabase, type Tables, type TablesInsert, type TablesUpdate } from '~/lib/supabase'

type ProfileRow = Tables<'profiles'>
type ProfileInsert = TablesInsert<'profiles'>
type ProfileUpdate = TablesUpdate<'profiles'>
type ShopRow = Tables<'shops'>

type UserRoleFilter = 'all' | 'A' | 'V' | 'U'
type UserStatusFilter = 'all' | 'active' | 'inactive' | 'banned' | 'deleted'
type UserFormMode = 'create' | 'edit'

type UserFormState = {
  id: string
  full_name: string
  username: string
  email: string
  phone: string
  avatar_url: string
  cover_url: string
  role: 'A' | 'V' | 'U'
  account_status: string
  bio: string
  headline: string
  occupation: string
  industry: string
  location: string
  business_name: string
  website_url: string
  preferred_currency: string
  preferred_language: string
  interestsText: string
  is_active: boolean
  is_verified: boolean
  email_verified: boolean
  phone_verified: boolean
  is_banned: boolean
  ban_reason: string
}

const PAGE_SIZE = 20

const EMPTY_FORM: UserFormState = {
  id: '',
  full_name: '',
  username: '',
  email: '',
  phone: '',
  avatar_url: '',
  cover_url: '',
  role: 'U',
  account_status: 'pending',
  bio: '',
  headline: '',
  occupation: '',
  industry: '',
  location: '',
  business_name: '',
  website_url: '',
  preferred_currency: 'INR',
  preferred_language: 'en',
  interestsText: '',
  is_active: true,
  is_verified: false,
  email_verified: false,
  phone_verified: false,
  is_banned: false,
  ban_reason: '',
}

export default function AdminUsersPage() {
  return <AdminUsersManager />
}

function AdminUsersManager() {
  const router = useRouter()
  const toast = useAppToast()
  const { isDesktop, safeBottom } = useAppLayout()

  const [users, setUsers] = useState<ProfileRow[]>([])
  const [shopsByUserId, setShopsByUserId] = useState<Record<string, ShopRow[]>>({})
  const [totalUsers, setTotalUsers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<UserFormMode>('create')
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0] ?? null
  const selectedUserShops = selectedUser ? shopsByUserId[selectedUser.id] ?? [] : []
  const hasMore = users.length < totalUsers

  const filters = useMemo(
    () => ({
      search: search.trim(),
      role: roleFilter,
      status: statusFilter,
    }),
    [roleFilter, search, statusFilter],
  )

  useEffect(() => {
    void loadUsers({ reset: true })
  }, [filters])

  useEffect(() => {
    if (!selectedUserId && users[0]) {
      setSelectedUserId(users[0].id)
    }
  }, [selectedUserId, users])

  async function loadUsers({ reset }: { reset: boolean }) {
    setLoading(true)
    setError(null)

    const from = reset ? 0 : users.length
    const to = from + PAGE_SIZE - 1
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (filters.search) {
      const value = escapeSearch(filters.search)
      query = query.or(
        `full_name.ilike.%${value}%,username.ilike.%${value}%,email.ilike.%${value}%,phone.ilike.%${value}%,business_name.ilike.%${value}%`,
      )
    }

    if (filters.role !== 'all') {
      query = query.eq('role', filters.role)
    }

    if (filters.status === 'active') {
      query = query.eq('is_active', true).eq('is_deleted', false)
    } else if (filters.status === 'inactive') {
      query = query.eq('is_active', false)
    } else if (filters.status === 'banned') {
      query = query.eq('is_banned', true)
    } else if (filters.status === 'deleted') {
      query = query.eq('is_deleted', true)
    }

    const { data, count, error: loadError } = await query

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    const nextUsers = (data ?? []) as ProfileRow[]
    setUsers((current) => (reset ? nextUsers : [...current, ...nextUsers]))
    setTotalUsers(count ?? nextUsers.length)
    await loadShopsForUsers(nextUsers.map((user) => user.id))
    setLoading(false)
  }

  async function loadShopsForUsers(userIds: string[]) {
    if (!userIds.length) return

    const { data, error: shopsError } = await supabase
      .from('shops')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })

    if (shopsError) {
      setError(shopsError.message)
      return
    }

    setShopsByUserId((current) => {
      const next = { ...current }
      for (const shop of (data ?? []) as ShopRow[]) {
        next[shop.user_id] = [...(next[shop.user_id] ?? []).filter((item) => item.id !== shop.id), shop]
      }
      for (const userId of userIds) {
        next[userId] = next[userId] ?? []
      }
      return next
    })
  }

  function openCreateForm() {
    setFormMode('create')
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEditForm(user: ProfileRow) {
    setFormMode('edit')
    setForm(profileToForm(user))
    setFormOpen(true)
  }

  function openDetails(user: ProfileRow) {
    setSelectedUserId(user.id)
    setDetailsOpen(true)
  }

  function openShop(shop: ShopRow) {
    router.push(commerceRoutes.shop(shop.slug ?? shop.id))
  }

  async function submitForm() {
    const validationError = validateForm(form, formMode)
    if (validationError) {
      toast.show('Check user details', { tone: 'danger', message: validationError })
      return
    }

    setSaving(true)
    setError(null)

    const payload = formToProfilePayload(form)
    const result =
      formMode === 'create'
        ? await supabase
            .from('profiles')
            .insert({ ...payload, id: form.id.trim(), username: form.username.trim() } as ProfileInsert)
            .select('*')
            .single()
        : await supabase
            .from('profiles')
            .update(payload as ProfileUpdate)
            .eq('id', form.id)
            .select('*')
            .single()

    if (result.error) {
      setError(result.error.message)
      toast.show('Unable to save user', { tone: 'danger', message: result.error.message })
      setSaving(false)
      return
    }

    const saved = result.data as ProfileRow
    setUsers((current) => {
      if (formMode === 'create') return [saved, ...current]
      return current.map((user) => (user.id === saved.id ? saved : user))
    })
    setSelectedUserId(saved.id)
    setFormOpen(false)
    setSaving(false)
    toast.show(formMode === 'create' ? 'User added' : 'User updated', { tone: 'success' })
  }

  async function toggleActive(user: ProfileRow) {
    await patchUser(user.id, {
      is_active: !user.is_active,
      account_status: user.is_active ? 'inactive' : 'active',
    })
  }

  async function toggleVerified(user: ProfileRow) {
    await patchUser(user.id, { is_verified: !user.is_verified })
  }

  async function softDeleteUser(user: ProfileRow) {
    await patchUser(user.id, {
      is_active: false,
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      account_status: 'inactive',
    })
  }

  async function restoreUser(user: ProfileRow) {
    await patchUser(user.id, {
      is_active: true,
      is_deleted: false,
      deleted_at: null,
      account_status: 'active',
    })
  }

  async function patchUser(userId: string, patch: ProfileUpdate) {
    setSaving(true)
    setError(null)

    const { data, error: patchError } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('*')
      .single()

    if (patchError) {
      setError(patchError.message)
      toast.show('Unable to update user', { tone: 'danger', message: patchError.message })
      setSaving(false)
      return
    }

    const updated = data as ProfileRow
    setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)))
    setSaving(false)
  }

  const stats = getStats(users, totalUsers)

  return (
    <YStack
      width="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop="$5"
      paddingBottom={safeBottom + 28}
    >
      <AdminUsersHeader stats={stats} onCreate={openCreateForm} />

      {error ? (
        <YStack padding="$3" borderRadius={radius.card} backgroundColor="$red3" borderWidth={1} borderColor="$red7">
          <Text color="$red11" fontWeight="700">
            {error}
          </Text>
        </YStack>
      ) : null}

      <AdminUserFilters
        search={search}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        onSearchChange={setSearch}
        onRoleChange={setRoleFilter}
        onStatusChange={setStatusFilter}
      />

      <AdminUserList
        users={users}
        shopsByUserId={shopsByUserId}
        selectedUserId={selectedUser?.id ?? null}
        loading={loading}
        hasMore={hasMore}
        total={totalUsers}
        onSelect={openDetails}
        onLoadMore={() => void loadUsers({ reset: false })}
      />

      <UserDetailsDialog
        open={detailsOpen}
        user={selectedUser}
        shops={selectedUserShops}
        busy={saving}
        onOpenChange={setDetailsOpen}
        onEdit={() => selectedUser && openEditForm(selectedUser)}
        onToggleActive={() => selectedUser && toggleActive(selectedUser)}
        onToggleVerified={() => selectedUser && toggleVerified(selectedUser)}
        onDelete={() => selectedUser && softDeleteUser(selectedUser)}
        onRestore={() => selectedUser && restoreUser(selectedUser)}
        onOpenShop={openShop}
      />

      <UserEditorDialog
        open={formOpen}
        mode={formMode}
        form={form}
        busy={saving}
        onOpenChange={setFormOpen}
        onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
        onSubmit={submitForm}
      />
    </YStack>
  )
}

function AdminUsersHeader({ stats, onCreate }: { stats: UserStats; onCreate: () => void }) {
  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontSize={26} fontWeight="800" color="$color12">
            User Management
          </Text>
          <Text color="$color10">
            View users, inspect related shops, jump to storefronts, and manage profile records.
          </Text>
        </YStack>
        <Button icon={Icons.UserPlus} onPress={onCreate}>
          Add user
        </Button>
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        {[
          { label: 'Total users', value: stats.total, tone: 'info' as const },
          { label: 'Active', value: stats.active, tone: 'success' as const },
          { label: 'Verified', value: stats.verified, tone: 'brand' as const },
          { label: 'Banned', value: stats.banned, tone: 'danger' as const },
        ].map((stat) => (
          <YStack
            key={stat.label}
            minWidth={150}
            flex={1}
            padding="$3"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor="$borderColor"
            backgroundColor="$background"
            style={getShadowStyle('sm')}
          >
            <Badge tone={stat.tone}>{stat.label}</Badge>
            <Text marginTop="$2" fontSize={24} fontWeight="800" color="$color12">
              {stat.value}
            </Text>
          </YStack>
        ))}
      </XStack>
    </YStack>
  )
}

function AdminUserFilters({
  search,
  roleFilter,
  statusFilter,
  onSearchChange,
  onRoleChange,
  onStatusChange,
}: {
  search: string
  roleFilter: UserRoleFilter
  statusFilter: UserStatusFilter
  onSearchChange: (value: string) => void
  onRoleChange: (value: UserRoleFilter) => void
  onStatusChange: (value: UserStatusFilter) => void
}) {
  const activeCount = [search.trim() ? 1 : 0, roleFilter !== 'all' ? 1 : 0, statusFilter !== 'all' ? 1 : 0].reduce(
    (total, value) => total + value,
    0,
  )

  function resetFilters() {
    onSearchChange('')
    onRoleChange('all')
    onStatusChange('all')
  }

  return (
    <YStack
      gap="$4"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$background"
      style={getShadowStyle('sm')}
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <XStack alignItems="center" gap="$2">
          <YStack width={34} height={34} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor="$color2">
            <Icons.SlidersHorizontal size={16} color="$color10" />
          </YStack>
          <YStack>
            <Text fontWeight="800" color="$color12">
              Filter users
            </Text>
            <Text fontSize={12} color="$color10">
              Search profile fields, role, and account state
            </Text>
          </YStack>
        </XStack>
        <XStack alignItems="center" gap="$2">
          {activeCount > 0 ? <Badge tone="brand">{activeCount} active</Badge> : null}
          <Button tone="ghost" size="$3" onPress={resetFilters} disabled={activeCount === 0}>
            Reset
          </Button>
        </XStack>
      </XStack>

      <XStack gap="$3" flexWrap="wrap" alignItems="flex-end" width="100%">
        <FilterField label="Search" flex={1.4} minWidth={240}>
          <Input value={search} onChangeText={onSearchChange} placeholder="Search name, username, email, phone, business" />
        </FilterField>
        <FilterField label="Role" flex={1} minWidth={190}>
          <FilterSelect
            value={roleFilter}
            options={[
              { value: 'all', label: 'All roles' },
              { value: 'A', label: 'Admin' },
              { value: 'V', label: 'Vendor' },
              { value: 'U', label: 'User' },
            ]}
            placeholder="Select role"
            onValueChange={(value) => onRoleChange(value as UserRoleFilter)}
          />
        </FilterField>
        <FilterField label="Status" flex={1} minWidth={210}>
          <FilterSelect
            value={statusFilter}
            options={[
              { value: 'all', label: 'All status' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'banned', label: 'Banned' },
              { value: 'deleted', label: 'Deleted' },
            ]}
            placeholder="Select status"
            onValueChange={(value) => onStatusChange(value as UserStatusFilter)}
          />
        </FilterField>
      </XStack>
    </YStack>
  )
}

function AdminUserList({
  users,
  shopsByUserId,
  selectedUserId,
  loading,
  hasMore,
  total,
  onSelect,
  onLoadMore,
}: {
  users: ProfileRow[]
  shopsByUserId: Record<string, ShopRow[]>
  selectedUserId: string | null
  loading: boolean
  hasMore: boolean
  total: number
  onSelect: (user: ProfileRow) => void
  onLoadMore: () => void
}) {
  if (loading && users.length === 0) {
    return (
      <YStack minHeight={260} alignItems="center" justifyContent="center">
        <Spinner size="large" />
        <Text marginTop="$2" color="$color10">
          Loading users...
        </Text>
      </YStack>
    )
  }

  if (!users.length) {
    return <EmptyPanel title="No users found" description="Try changing filters or add a new profile record." />
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="800" color="$color12">
          All users
        </Text>
        <Text color="$color10">
          {users.length} of {total}
        </Text>
      </XStack>

      {users.map((user) => (
        <UserRow
          key={user.id}
          user={user}
          shops={shopsByUserId[user.id] ?? []}
          active={user.id === selectedUserId}
          onPress={() => onSelect(user)}
        />
      ))}

      {hasMore ? (
        <Button tone="outline" onPress={onLoadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load more users'}
        </Button>
      ) : (
        <Text textAlign="center" color="$color10">
          End of user list
        </Text>
      )}
    </YStack>
  )
}

function UserRow({ user, shops, active, onPress }: { user: ProfileRow; shops: ShopRow[]; active: boolean; onPress: () => void }) {
  return (
    <XStack
      gap="$3"
      padding="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={active ? '$color9' : '$borderColor'}
      backgroundColor={active ? '$color2' : '$background'}
      cursor="pointer"
      animation="quick"
      hoverStyle={{ borderColor: '$color8' }}
      onPress={onPress}
      style={getShadowStyle('sm')}
    >
      <UserAvatar user={user} size={52} />
      <YStack flex={1} minWidth={0} gap="$1">
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Text fontWeight="800" color="$color12" numberOfLines={1}>
            {displayName(user)}
          </Text>
          <Badge tone={roleTone(user.role)} size="sm">
            {formatRole(user.role)}
          </Badge>
          <Badge tone={user.is_active && !user.is_deleted ? 'success' : 'danger'} size="sm">
            {user.is_deleted ? 'Deleted' : user.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {user.is_verified ? (
            <Badge tone="success" size="sm">
              Verified
            </Badge>
          ) : null}
        </XStack>
        <Text color="$color10" numberOfLines={1}>
          {user.email || user.phone || user.id}
        </Text>
        <Text color="$color10" fontSize={12}>
          {shops.length} shop{shops.length === 1 ? '' : 's'} • {user.profile_completion_percentage}% complete
        </Text>
      </YStack>
      <Icons.ChevronRight size={18} color="$color10" />
    </XStack>
  )
}

function UserDetailsDialog({
  open,
  user,
  shops,
  busy,
  onOpenChange,
  onEdit,
  onToggleActive,
  onToggleVerified,
  onDelete,
  onRestore,
  onOpenShop,
}: {
  open: boolean
  user: ProfileRow | null
  shops: ShopRow[]
  busy: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onToggleActive: () => void
  onToggleVerified: () => void
  onDelete: () => void
  onRestore: () => void
  onOpenShop: (shop: ShopRow) => void
}) {
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={1040} maxHeight="92vh" width="94%" padding={0} overflow="hidden">
          <YStack padding="$5" paddingTop="$6" paddingRight="$10" gap="$3" backgroundColor="$color2" borderBottomWidth={1} borderBottomColor="$borderColor">
            <YStack gap="$1">
              <DialogTitle>{user ? displayName(user) : 'User details'}</DialogTitle>
              <DialogDescription>Review profile data, admin state, social/contact fields, and related shops.</DialogDescription>
            </YStack>
          </YStack>
          <ScrollView maxHeight="74vh" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            {user ? (
              <UserDetailsPanel
                user={user}
                shops={shops}
                busy={busy}
                onEdit={onEdit}
                onToggleActive={onToggleActive}
                onToggleVerified={onToggleVerified}
                onDelete={onDelete}
                onRestore={onRestore}
                onOpenShop={onOpenShop}
              />
            ) : (
              <EmptyPanel title="No user selected" description="Select a user to view details." />
            )}
          </ScrollView>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}

function UserDetailsPanel({
  user,
  shops,
  busy,
  onEdit,
  onToggleActive,
  onToggleVerified,
  onDelete,
  onRestore,
  onOpenShop,
}: {
  user: ProfileRow
  shops: ShopRow[]
  busy: boolean
  onEdit: () => void
  onToggleActive: () => void
  onToggleVerified: () => void
  onDelete: () => void
  onRestore: () => void
  onOpenShop: (shop: ShopRow) => void
}) {
  return (
    <YStack gap="$4">
      <XStack gap="$3" alignItems="center" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
        <UserAvatar user={user} size={68} />
        <YStack flex={1} minWidth={0}>
          <Text fontSize={22} fontWeight="800" color="$color12" numberOfLines={1}>
            {displayName(user)}
          </Text>
          <Text color="$color10" numberOfLines={1}>
            @{user.username} • {user.email ?? 'No email'}
          </Text>
          <XStack gap="$2" marginTop="$2" flexWrap="wrap">
            <Badge tone={roleTone(user.role)}>{formatRole(user.role)}</Badge>
            <Badge tone={user.is_active && !user.is_deleted ? 'success' : 'danger'}>
              {user.is_deleted ? 'Deleted' : user.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {user.is_banned ? <Badge tone="danger">Banned</Badge> : null}
            {user.is_online ? <Badge tone="success">Online</Badge> : null}
          </XStack>
        </YStack>
      </XStack>

      <XStack gap="$2" flexWrap="wrap" padding="$3" borderRadius={radius.card} backgroundColor="$color2" borderWidth={1} borderColor="$borderColor">
        <Button size="$3" tone="outline" icon={Icons.Pencil} onPress={onEdit} disabled={busy}>
          Edit
        </Button>
        <Button size="$3" tone={user.is_verified ? 'outline' : 'primary'} onPress={onToggleVerified} disabled={busy}>
          {user.is_verified ? 'Unverify' : 'Verify'}
        </Button>
        <Button size="$3" tone="outline" onPress={onToggleActive} disabled={busy || !!user.is_deleted}>
          {user.is_active ? 'Deactivate' : 'Activate'}
        </Button>
        {user.is_deleted ? (
          <Button size="$3" tone="outline" icon={Icons.RotateCcw} onPress={onRestore} disabled={busy}>
            Restore
          </Button>
        ) : (
          <ConfirmDialog
            title="Delete user?"
            description="This soft-deletes the profile by marking it inactive and deleted. It does not remove the auth user."
            confirmLabel="Delete user"
            destructive
            onConfirm={onDelete}
            trigger={
              <Button size="$3" tone="destructive" icon={Icons.Trash2} disabled={busy}>
                Delete
              </Button>
            }
          />
        )}
      </XStack>

      <DetailSection title="Related shops">
        {shops.length ? (
          <YStack gap="$2">
            {shops.map((shop) => (
              <ShopLinkRow key={shop.id} shop={shop} onPress={() => onOpenShop(shop)} />
            ))}
          </YStack>
        ) : (
          <Text color="$color10">No shops linked to this user.</Text>
        )}
      </DetailSection>

      <DetailSection title="Profile">
        <DetailRow label="User id" value={user.id} />
        <DetailRow label="Full name" value={user.full_name ?? 'Not set'} />
        <DetailRow label="Username" value={`@${user.username}`} />
        <DetailRow label="Headline" value={user.headline ?? 'Not set'} />
        <DetailRow label="Bio" value={user.bio ?? 'No bio'} />
        <DetailRow label="Occupation" value={user.occupation ?? 'Not set'} />
        <DetailRow label="Industry" value={user.industry ?? 'Not set'} />
        <DetailRow label="Business name" value={user.business_name ?? 'Not set'} />
        <DetailRow label="Location" value={user.location ?? 'Not set'} />
        <DetailRow label="Interests" value={(user.interests ?? []).join(', ') || 'No interests'} />
      </DetailSection>

      <DetailSection title="Contact & verification">
        <DetailRow label="Email" value={user.email ?? 'Not set'} />
        <DetailRow label="Phone" value={user.phone ?? 'Not set'} />
        <DetailRow label="Website" value={user.website_url ?? 'Not set'} />
        <DetailRow label="Profile verified" value={yesNo(user.is_verified)} />
        <DetailRow label="Email verified" value={yesNo(user.email_verified)} />
        <DetailRow label="Phone verified" value={yesNo(user.phone_verified)} />
        <DetailRow label="Gender verified at" value={formatDate(user.gender_verified_at)} />
      </DetailSection>

      <DetailSection title="Account state">
        <DetailRow label="Account status" value={user.account_status} />
        <DetailRow label="Role" value={formatRole(user.role)} />
        <DetailRow label="Completion" value={`${user.profile_completion_percentage}%`} />
        <DetailRow label="Followers" value={user.follower_count ?? 0} />
        <DetailRow label="Following" value={user.following_count ?? 0} />
        <DetailRow label="Connections" value={user.connections_count ?? 0} />
        <DetailRow label="Login count" value={user.login_count} />
        <DetailRow label="Last seen" value={formatDate(user.last_seen)} />
        <DetailRow label="Created" value={formatDate(user.created_at)} />
        <DetailRow label="Updated" value={formatDate(user.updated_at)} />
        <DetailRow label="Ban reason" value={user.ban_reason ?? 'Not banned'} />
      </DetailSection>

      <DetailSection title="Social links">
        <DetailRow label="Professional profile" value={user.linkedin_url ?? 'Not set'} />
        <DetailRow label="Twitter/X" value={user.twitter_url ?? 'Not set'} />
        <DetailRow label="GitHub" value={user.github_url ?? 'Not set'} />
        <DetailRow label="Instagram" value={user.instagram_url ?? 'Not set'} />
        <DetailRow label="YouTube" value={user.youtube_url ?? 'Not set'} />
        <DetailRow label="Social profile" value={user.facebook_url ?? 'Not set'} />
        <DetailRow label="Portfolio" value={user.portfolio_url ?? 'Not set'} />
      </DetailSection>
    </YStack>
  )
}

function ShopLinkRow({ shop, onPress }: { shop: ShopRow; onPress: () => void }) {
  return (
    <XStack
      gap="$3"
      alignItems="center"
      padding="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$color2"
      cursor="pointer"
      hoverStyle={{ borderColor: '$color8' }}
      onPress={onPress}
    >
      {shop.logo_url ? (
        <Image source={{ uri: shop.logo_url }} width={44} height={44} borderRadius={radius.card} backgroundColor="$color3" />
      ) : (
        <YStack width={44} height={44} borderRadius={radius.card} alignItems="center" justifyContent="center" backgroundColor="$color3">
          <Icons.Store size={20} color="$color10" />
        </YStack>
      )}
      <YStack flex={1} minWidth={0}>
        <Text fontWeight="800" color="$color12" numberOfLines={1}>
          {shop.shop_name}
        </Text>
        <Text color="$color10" fontSize={12} numberOfLines={1}>
          {shop.slug ? `/shop/${shop.slug}` : shop.id}
        </Text>
      </YStack>
      <Badge tone={shop.verified ? 'success' : 'warning'} size="sm">
        {shop.verified ? 'Verified' : 'Pending'}
      </Badge>
      <Icons.ExternalLink size={17} color="$color10" />
    </XStack>
  )
}

function UserEditorDialog({
  open,
  mode,
  form,
  busy,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  open: boolean
  mode: UserFormMode
  form: UserFormState
  busy: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<UserFormState>) => void
  onSubmit: () => void
}) {
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <DialogOverlay />
        <DialogContent maxWidth={820} maxHeight="90vh" width="92%">
          <DialogTitle>{mode === 'create' ? 'Add user profile' : 'Edit user profile'}</DialogTitle>
          <DialogDescription>
            This writes directly to the profiles table. For new users, the id must already exist in auth.users.
          </DialogDescription>

          <ScrollView maxHeight="68vh" showsVerticalScrollIndicator={false}>
            <YStack gap="$3" paddingRight="$1">
              <Field label="Auth user id" required>
                <Input
                  value={form.id}
                  editable={mode === 'create'}
                  onChangeText={(id) => onChange({ id })}
                  placeholder="UUID from auth.users"
                />
              </Field>

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={220}>
                  <Field label="Username" required>
                    <Input value={form.username} onChangeText={(username) => onChange({ username })} placeholder="username" />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={220}>
                  <Field label="Full name">
                    <Input value={form.full_name} onChangeText={(full_name) => onChange({ full_name })} placeholder="Full name" />
                  </Field>
                </YStack>
              </XStack>

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={220}>
                  <Field label="Email">
                    <Input value={form.email} onChangeText={(email) => onChange({ email })} placeholder="user@example.com" />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={220}>
                  <Field label="Phone">
                    <Input value={form.phone} onChangeText={(phone) => onChange({ phone })} placeholder="+91..." />
                  </Field>
                </YStack>
              </XStack>

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={160}>
                  <Field label="Role">
                    <FilterSelect
                      value={form.role}
                      options={[
                        { value: 'U', label: 'User' },
                        { value: 'V', label: 'Vendor' },
                        { value: 'A', label: 'Admin' },
                      ]}
                      placeholder="Select role"
                      onValueChange={(role) => onChange({ role: role as UserFormState['role'] })}
                    />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={180}>
                  <Field label="Account status">
                    <FilterSelect
                      value={form.account_status}
                      options={[
                        { value: 'pending', label: 'Pending' },
                        { value: 'active', label: 'Active' },
                        { value: 'suspended', label: 'Suspended' },
                        { value: 'banned', label: 'Banned' },
                        { value: 'inactive', label: 'Inactive' },
                      ]}
                      placeholder="Select status"
                      onValueChange={(account_status) => onChange({ account_status })}
                    />
                  </Field>
                </YStack>
              </XStack>

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={220}>
                  <Field label="Headline">
                    <Input value={form.headline} onChangeText={(headline) => onChange({ headline })} placeholder="Founder, designer..." />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={220}>
                  <Field label="Business name">
                    <Input value={form.business_name} onChangeText={(business_name) => onChange({ business_name })} placeholder="Business" />
                  </Field>
                </YStack>
              </XStack>

              <Field label="Bio">
                <TextArea value={form.bio} onChangeText={(bio) => onChange({ bio })} placeholder="Short profile bio" />
              </Field>

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={180}>
                  <Field label="Occupation">
                    <Input value={form.occupation} onChangeText={(occupation) => onChange({ occupation })} placeholder="Occupation" />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={180}>
                  <Field label="Industry">
                    <Input value={form.industry} onChangeText={(industry) => onChange({ industry })} placeholder="Industry" />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={180}>
                  <Field label="Location">
                    <Input value={form.location} onChangeText={(location) => onChange({ location })} placeholder="City, country" />
                  </Field>
                </YStack>
              </XStack>

              <Field label="Interests">
                <Input value={form.interestsText} onChangeText={(interestsText) => onChange({ interestsText })} placeholder="Fashion, Finance" />
              </Field>

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={220}>
                  <Field label="Avatar URL">
                    <Input value={form.avatar_url} onChangeText={(avatar_url) => onChange({ avatar_url })} placeholder="https://..." />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={220}>
                  <Field label="Cover URL">
                    <Input value={form.cover_url} onChangeText={(cover_url) => onChange({ cover_url })} placeholder="https://..." />
                  </Field>
                </YStack>
              </XStack>

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minWidth={180}>
                  <Field label="Currency">
                    <Input value={form.preferred_currency} maxLength={3} onChangeText={(preferred_currency) => onChange({ preferred_currency })} placeholder="INR" />
                  </Field>
                </YStack>
                <YStack flex={1} minWidth={180}>
                  <Field label="Language">
                    <Input value={form.preferred_language} maxLength={5} onChangeText={(preferred_language) => onChange({ preferred_language })} placeholder="en" />
                  </Field>
                </YStack>
                <YStack flex={2} minWidth={220}>
                  <Field label="Website">
                    <Input value={form.website_url} onChangeText={(website_url) => onChange({ website_url })} placeholder="https://..." />
                  </Field>
                </YStack>
              </XStack>

              <XStack gap="$3" flexWrap="wrap">
                <ToggleField label="Active" value={form.is_active} onChange={(is_active) => onChange({ is_active })} />
                <ToggleField label="Verified" value={form.is_verified} onChange={(is_verified) => onChange({ is_verified })} />
                <ToggleField label="Email verified" value={form.email_verified} onChange={(email_verified) => onChange({ email_verified })} />
                <ToggleField label="Phone verified" value={form.phone_verified} onChange={(phone_verified) => onChange({ phone_verified })} />
                <ToggleField label="Banned" value={form.is_banned} onChange={(is_banned) => onChange({ is_banned })} />
              </XStack>

              {form.is_banned ? (
                <Field label="Ban reason">
                  <TextArea value={form.ban_reason} onChangeText={(ban_reason) => onChange({ ban_reason })} placeholder="Reason for ban" />
                </Field>
              ) : null}
            </YStack>
          </ScrollView>

          <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
            <Button tone="outline" onPress={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onPress={onSubmit} disabled={busy || !form.username.trim() || (mode === 'create' && !form.id.trim())}>
              {busy ? 'Saving...' : mode === 'create' ? 'Add user' : 'Save changes'}
            </Button>
          </XStack>
        </DialogContent>
      </Dialog.Portal>
    </Dialog>
  )
}

function FilterField({
  label,
  children,
  flex,
  minWidth,
}: {
  label: string
  children: ReactNode
  flex?: number
  minWidth?: number
}) {
  return (
    <YStack gap="$1.5" flex={flex} minWidth={minWidth}>
      <Text fontSize={12} fontWeight="700" color="$color10">
        {label}
      </Text>
      {children}
    </YStack>
  )
}

function FilterSelect({
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

function UserAvatar({ user, size }: { user: ProfileRow; size: number }) {
  if (user.avatar_url) {
    return <Image source={{ uri: user.avatar_url }} width={size} height={size} borderRadius={999} backgroundColor="$color3" />
  }

  return (
    <YStack width={size} height={size} borderRadius={999} alignItems="center" justifyContent="center" backgroundColor="$color3">
      <Icons.User size={Math.round(size * 0.42)} color="$color10" />
    </YStack>
  )
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <YStack gap="$2.5" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background" style={getShadowStyle('sm')}>
      <XStack alignItems="center" gap="$2">
        <YStack width={4} height={18} borderRadius={999} backgroundColor="$color9" />
        <Text fontSize={14} fontWeight="800" color="$color12">
          {title}
        </Text>
      </XStack>
      <YStack gap="$2.5">{children}</YStack>
    </YStack>
  )
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <XStack gap="$3" justifyContent="space-between" alignItems="flex-start">
      <Text flex={1} color="$color10" fontSize={12}>
        {label}
      </Text>
      <Text flex={2} color="$color12" fontSize={12} fontWeight="600" textAlign="right">
        {String(value)}
      </Text>
    </XStack>
  )
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <YStack minHeight={220} alignItems="center" justifyContent="center" gap="$2" padding="$4" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
      <Icons.Users size={28} color="$color10" />
      <Text fontWeight="800" color="$color12">
        {title}
      </Text>
      <Text color="$color10" textAlign="center">
        {description}
      </Text>
    </YStack>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <YStack gap="$2">
      <Text fontSize={12} fontWeight="700" color="$color11">
        {label}
        {required ? ' *' : ''}
      </Text>
      {children}
    </YStack>
  )
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <XStack minWidth={150} flex={1} alignItems="center" justifyContent="space-between" gap="$2" padding="$3" borderRadius={radius.card} borderWidth={1} borderColor="$borderColor">
      <Text fontWeight="700" color="$color12" fontSize={12}>
        {label}
      </Text>
      <Switch checked={value} onCheckedChange={onChange} />
    </XStack>
  )
}

type UserStats = {
  total: number
  active: number
  verified: number
  banned: number
}

function getStats(users: ProfileRow[], totalUsers: number): UserStats {
  return {
    total: totalUsers,
    active: users.filter((user) => user.is_active && !user.is_deleted).length,
    verified: users.filter((user) => user.is_verified).length,
    banned: users.filter((user) => user.is_banned).length,
  }
}

function profileToForm(user: ProfileRow): UserFormState {
  return {
    id: user.id,
    full_name: user.full_name ?? '',
    username: user.username,
    email: user.email ?? '',
    phone: user.phone ?? '',
    avatar_url: user.avatar_url ?? '',
    cover_url: user.cover_url ?? '',
    role: normalizeRole(user.role),
    account_status: user.account_status,
    bio: user.bio ?? '',
    headline: user.headline ?? '',
    occupation: user.occupation ?? '',
    industry: user.industry ?? '',
    location: user.location ?? '',
    business_name: user.business_name ?? '',
    website_url: user.website_url ?? '',
    preferred_currency: user.preferred_currency,
    preferred_language: user.preferred_language,
    interestsText: (user.interests ?? []).join(', '),
    is_active: user.is_active,
    is_verified: user.is_verified,
    email_verified: user.email_verified,
    phone_verified: user.phone_verified,
    is_banned: !!user.is_banned,
    ban_reason: user.ban_reason ?? '',
  }
}

function formToProfilePayload(form: UserFormState): ProfileUpdate {
  return {
    username: form.username.trim(),
    full_name: nullableText(form.full_name),
    email: nullableText(form.email),
    phone: nullableText(form.phone),
    avatar_url: nullableText(form.avatar_url),
    cover_url: nullableText(form.cover_url),
    role: form.role,
    account_status: form.account_status,
    bio: nullableText(form.bio),
    headline: nullableText(form.headline),
    occupation: nullableText(form.occupation),
    industry: nullableText(form.industry),
    location: nullableText(form.location),
    business_name: nullableText(form.business_name),
    website_url: nullableText(form.website_url),
    preferred_currency: form.preferred_currency.trim().toUpperCase() || 'INR',
    preferred_language: form.preferred_language.trim() || 'en',
    interests: splitCsv(form.interestsText),
    is_active: form.is_active,
    is_verified: form.is_verified,
    email_verified: form.email_verified,
    phone_verified: form.phone_verified,
    is_banned: form.is_banned,
    ban_reason: form.is_banned ? nullableText(form.ban_reason) : null,
  }
}

function validateForm(form: UserFormState, mode: UserFormMode) {
  if (mode === 'create' && !form.id.trim()) return 'Auth user id is required.'
  if (!form.username.trim()) return 'Username is required.'
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(form.username.trim())) {
    return 'Username must be 3-30 characters and use only letters, numbers, and underscore.'
  }
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'Enter a valid email address.'
  }
  return null
}

function displayName(user: ProfileRow) {
  return user.full_name || user.business_name || user.username || 'Unnamed user'
}

function formatRole(role: string) {
  if (role === 'A') return 'Admin'
  if (role === 'V') return 'Vendor'
  return 'User'
}

function roleTone(role: string) {
  if (role === 'A') return 'danger' as const
  if (role === 'V') return 'brand' as const
  return 'neutral' as const
}

function normalizeRole(role: string): UserFormState['role'] {
  if (role === 'A' || role === 'V' || role === 'U') return role
  return 'U'
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function escapeSearch(value: string) {
  return value.replace(/[%(),]/g, '')
}

function yesNo(value: boolean | null | undefined) {
  return value ? 'Yes' : 'No'
}

function formatDate(value: string | null) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleString()
}
