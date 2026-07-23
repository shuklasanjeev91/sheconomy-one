import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'

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
} from '~/components/ui'
import { AppBottomSheet } from '~/components/ui'
import { ImageUploadField } from '~/components/media/ImageUploadField'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { pickedImageToBlob, type PickedImage } from '~/lib/media/pick-image'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import {
  clearCurrentEvent,
  createEvent,
  createOffer,
  deleteBannerImage,
  deleteEvent,
  DEFAULT_SALE_CURRENCY,
  DISCOUNT_TYPE,
  ENROLLMENT_STATUS,
  formatDiscountLabel,
  formatEventDate,
  generateEventSlug,
  getCurrencySymbol,
  getEnrollmentStatusLabel,
  getEventDurationLabel,
  isEventActive,
  isEventExpired,
  loadEventById,
  loadEventEnrollments,
  loadEvents,
  OFFER_APPLIES_TO,
  SALE_BANNER_SPECS,
  SALE_CURRENCY_CODES,
  SALE_EVENT_STATUS,
  updateEnrollmentStatus,
  updateEvent,
  uploadBannerImage,
  validateBannerFile,
  type EventOffer,
  type SaleEnrollmentRow,
  type SaleEventDetail,
  type SaleEventStatus,
  type SaleEventWithCounts,
} from '~/lib/sale-event'

// ============================================================================
// TYPES
// ============================================================================

type StatusFilter = 'all' | SaleEventStatus
type FormMode = 'create' | 'edit'

type EventFormState = {
  event_name: string
  event_slug: string
  slugTouched: boolean
  description: string
  start_date: string
  end_date: string
  registration_start_date: string
  registration_end_date: string
  currency: string
  status: SaleEventStatus
  bannerUrl: string
  bannerPick: PickedImage[]
}

type OfferFormState = {
  offer_name: string
  discount_type: string
  discount_value: string
  applies_to: string
  min_order_amount: string
  max_discount_amount: string
  max_uses_total: string
  max_uses_per_customer: string
}

const EMPTY_FORM: EventFormState = {
  event_name: '',
  event_slug: '',
  slugTouched: false,
  description: '',
  start_date: '',
  end_date: '',
  registration_start_date: '',
  registration_end_date: '',
  currency: DEFAULT_SALE_CURRENCY,
  status: SALE_EVENT_STATUS.DRAFT,
  bannerUrl: '',
  bannerPick: [],
}

const EMPTY_OFFER: OfferFormState = {
  offer_name: '',
  discount_type: DISCOUNT_TYPE.PERCENTAGE,
  discount_value: '',
  applies_to: OFFER_APPLIES_TO.ORDER,
  min_order_amount: '',
  max_discount_amount: '',
  max_uses_total: '',
  max_uses_per_customer: '1',
}

// ============================================================================
// HELPERS
// ============================================================================

function isoToLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isStorageBanner(url: string | null | undefined): boolean {
  return !!url && url.includes('/storage/v1/object/public/sale-event-banners/')
}

function statusTone(status: string): 'success' | 'warning' | 'neutral' | 'danger' {
  if (status === SALE_EVENT_STATUS.ACTIVE) return 'success'
  if (status === SALE_EVENT_STATUS.DRAFT) return 'warning'
  if (status === SALE_EVENT_STATUS.EXPIRED) return 'danger'
  return 'neutral'
}

// ============================================================================
// MAIN
// ============================================================================

export function AdminSaleEventsManager() {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop, safeBottom } = useAppLayout()

  const {
    events,
    currentEvent,
    offers,
    enrollments,
    isLoadingEvents,
    isSavingEvent,
    isDeletingEvent,
    isSavingOffer,
    isLoadingEnrollments,
    isUpdatingEnrollment,
    error,
  } = useAppSelector((state) => state.sale)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [originalBanner, setOriginalBanner] = useState<string | null>(null)
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SaleEventWithCounts | null>(null)

  useEffect(() => {
    dispatch(loadEvents())
  }, [dispatch])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return events.filter((event) => {
      if (statusFilter !== 'all' && event.status !== statusFilter) return false
      if (!term) return true
      return (
        event.event_name?.toLowerCase().includes(term) ||
        event.event_slug?.toLowerCase().includes(term) ||
        event.description?.toLowerCase().includes(term)
      )
    })
  }, [events, search, statusFilter])

  const patchForm = useCallback((patch: Partial<EventFormState>) => {
    setForm((current) => ({ ...current, ...patch }))
  }, [])

  function openCreateForm() {
    setFormMode('create')
    setEditingId(null)
    setOriginalBanner(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEditForm(event: SaleEventWithCounts | SaleEventDetail) {
    setFormMode('edit')
    setEditingId(event.id)
    setOriginalBanner(event.banner_image ?? null)
    setForm({
      event_name: event.event_name ?? '',
      event_slug: event.event_slug ?? '',
      slugTouched: true,
      description: event.description ?? '',
      start_date: isoToLocalInput(event.start_date),
      end_date: isoToLocalInput(event.end_date),
      registration_start_date: isoToLocalInput(event.registration_start_date),
      registration_end_date: isoToLocalInput(event.registration_end_date),
      currency: event.currency ?? DEFAULT_SALE_CURRENCY,
      status: (event.status as SaleEventStatus) ?? SALE_EVENT_STATUS.DRAFT,
      bannerUrl: event.banner_image ?? '',
      bannerPick: [],
    })
    setFormOpen(true)
  }

  async function submitEvent() {
    if (!form.event_name.trim() || !form.event_slug.trim() || !form.start_date || !form.end_date) {
      toast.show('Missing required fields', {
        tone: 'danger',
        message: 'Name, slug, start and end dates are required.',
      })
      return
    }

    let bannerImage: string | null = form.bannerUrl.trim() || null

    const picked = form.bannerPick[0]
    if (picked) {
      try {
        const blob = await pickedImageToBlob(picked)
        const fileArg = {
          blob,
          mimeType: picked.mimeType || blob.type || 'image/jpeg',
          fileName: picked.fileName || `banner-${Date.now()}.jpg`,
          fileSize: picked.file?.size ?? blob.size,
        }
        const check = await validateBannerFile(fileArg)
        if (!check.valid) {
          toast.show('Invalid banner image', { tone: 'danger', message: check.error })
          return
        }
        setUploadingBanner(true)
        const res = await uploadBannerImage(fileArg, editingId ?? undefined)
        setUploadingBanner(false)
        if (!res.success || !res.data) {
          toast.show('Banner upload failed', { tone: 'danger', message: res.error ?? undefined })
          return
        }
        bannerImage = res.data.url
      } catch (err) {
        setUploadingBanner(false)
        toast.show('Banner upload failed', {
          tone: 'danger',
          message: err instanceof Error ? err.message : 'Try again.',
        })
        return
      }
    }

    const payload = {
      event_name: form.event_name.trim(),
      event_slug: form.event_slug.trim().toLowerCase(),
      description: nullableText(form.description),
      start_date: form.start_date,
      end_date: form.end_date,
      registration_start_date: form.registration_start_date || null,
      registration_end_date: form.registration_end_date || null,
      currency: form.currency,
      status: form.status,
      banner_image: bannerImage,
    }

    try {
      if (formMode === 'create') {
        await dispatch(createEvent(payload)).unwrap()
        toast.show('Event created', { tone: 'success', message: `"${payload.event_name}" is ready.` })
      } else if (editingId) {
        await dispatch(updateEvent({ eventId: editingId, payload })).unwrap()
        toast.show('Event updated', { tone: 'success', message: 'Your changes were saved.' })
        if (isStorageBanner(originalBanner) && originalBanner !== bannerImage) {
          void deleteBannerImage(originalBanner)
        }
      }
      setFormOpen(false)
    } catch (message) {
      toast.show('Could not save event', { tone: 'danger', message: String(message) })
    }
  }

  async function removeFormBanner() {
    patchForm({ bannerUrl: '', bannerPick: [] })
  }

  function openDetail(eventId: string) {
    setDetailOpen(true)
    dispatch(loadEventById(eventId))
    dispatch(loadEventEnrollments(eventId))
  }

  function closeDetail() {
    setDetailOpen(false)
    dispatch(clearCurrentEvent())
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await dispatch(deleteEvent(target.id)).unwrap()
      toast.show('Event deleted', { tone: 'success', message: `"${target.event_name}" was removed.` })
      if (isStorageBanner(target.banner_image)) void deleteBannerImage(target.banner_image)
      setDeleteTarget(null)
    } catch (message) {
      toast.show('Could not delete event', { tone: 'danger', message: String(message) })
    }
  }

  async function decideEnrollment(enrollmentId: string, status: typeof ENROLLMENT_STATUS.ACCEPTED | typeof ENROLLMENT_STATUS.REJECTED) {
    try {
      await dispatch(updateEnrollmentStatus({ enrollmentId, status })).unwrap()
      toast.show(status === ENROLLMENT_STATUS.ACCEPTED ? 'Enrollment accepted' : 'Enrollment rejected', {
        tone: status === ENROLLMENT_STATUS.ACCEPTED ? 'success' : 'default',
      })
    } catch (message) {
      toast.show('Could not update enrollment', { tone: 'danger', message: String(message) })
    }
  }

  const stats = useMemo(() => {
    const total = events.length
    const active = events.filter((e) => e.status === SALE_EVENT_STATUS.ACTIVE).length
    const draft = events.filter((e) => e.status === SALE_EVENT_STATUS.DRAFT).length
    const enrollmentTotal = events.reduce((sum, e) => sum + (e.enrollment_count ?? 0), 0)
    return { total, active, draft, enrollmentTotal }
  }, [events])

  const busy = isSavingEvent || uploadingBanner

  return (
    <YStack
      width="100%"
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop="$5"
      paddingBottom={safeBottom + 28}
    >
      <SaleHeader ui={ui} stats={stats} onCreate={openCreateForm} onRefresh={() => dispatch(loadEvents())} />

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

      <SaleFilters
        ui={ui}
        search={search}
        statusFilter={statusFilter}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
      />

      <SaleEventList
        ui={ui}
        events={filtered}
        total={events.length}
        loading={isLoadingEvents}
        isDesktop={isDesktop}
        onOpen={openDetail}
        onEdit={openEditForm}
        onDelete={setDeleteTarget}
      />

      <EventFormSheet
        ui={ui}
        open={formOpen}
        mode={formMode}
        form={form}
        busy={busy}
        uploadingBanner={uploadingBanner}
        onOpenChange={setFormOpen}
        onChange={patchForm}
        onRemoveBanner={removeFormBanner}
        onSubmit={submitEvent}
      />

      <EventDetailSheet
        ui={ui}
        open={detailOpen}
        isDesktop={isDesktop}
        event={currentEvent}
        offers={offers}
        enrollments={enrollments}
        loadingEnrollments={isLoadingEnrollments}
        updatingEnrollment={isUpdatingEnrollment}
        savingOffer={isSavingOffer}
        onOpenChange={(open) => (open ? setDetailOpen(true) : closeDetail())}
        onEdit={() => {
          if (!currentEvent) return
          setDetailOpen(false)
          openEditForm(currentEvent)
        }}
        onDelete={() => {
          if (!currentEvent) return
          setDetailOpen(false)
          setDeleteTarget(currentEvent)
        }}
        onCreateOffer={async (offer) => {
          if (!currentEvent) return false
          try {
            await dispatch(createOffer({ event_id: currentEvent.id, ...offer })).unwrap()
            toast.show('Offer created', { tone: 'success' })
            return true
          } catch (message) {
            toast.show('Could not create offer', { tone: 'danger', message: String(message) })
            return false
          }
        }}
        onDecideEnrollment={decideEnrollment}
      />

      <ConfirmDeleteSheet
        ui={ui}
        event={deleteTarget}
        busy={isDeletingEvent}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </YStack>
  )
}

// ============================================================================
// HEADER
// ============================================================================

function SaleHeader({
  ui,
  stats,
  onCreate,
  onRefresh,
}: {
  ui: AppUiTokens
  stats: { total: number; active: number; draft: number; enrollmentTotal: number }
  onCreate: () => void
  onRefresh: () => void
}) {
  const cards = [
    { label: 'Total events', value: stats.total, tone: 'info' as const, icon: Icons.BarChart3 },
    { label: 'Active', value: stats.active, tone: 'success' as const, icon: Icons.Zap },
    { label: 'Drafts', value: stats.draft, tone: 'warning' as const, icon: Icons.FileText },
    { label: 'Enrollments', value: stats.enrollmentTotal, tone: 'brand' as const, icon: Icons.Users },
  ]

  return (
    <YStack gap="$3.5">
      <XStack alignItems="center" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minWidth={220}>
          <Text fontSize={26} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
            Sale Events
          </Text>
          <Text color={ui.textSecondary}>
            Plan campaigns, upload banners, publish offers, and review vendor enrollments.
          </Text>
        </YStack>
        <XStack gap="$2">
          <Button tone="outline" icon={Icons.RefreshCw} onPress={onRefresh}>
            Refresh
          </Button>
          <Button icon={Icons.Plus} onPress={onCreate}>
            Create event
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

function SaleFilters({
  ui,
  search,
  statusFilter,
  onSearchChange,
  onStatusChange,
}: {
  ui: AppUiTokens
  search: string
  statusFilter: StatusFilter
  onSearchChange: (value: string) => void
  onStatusChange: (value: StatusFilter) => void
}) {
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: SALE_EVENT_STATUS.DRAFT, label: 'Draft' },
    { value: SALE_EVENT_STATUS.ACTIVE, label: 'Active' },
    { value: SALE_EVENT_STATUS.EXPIRED, label: 'Expired' },
  ]

  return (
    <XStack
      gap="$3"
      flexWrap="wrap"
      alignItems="flex-end"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      <Field label="Search" flex={2} minWidth={240}>
        <Input value={search} onChangeText={onSearchChange} placeholder="Search by name, slug, or description" />
      </Field>
      <Field label="Status" flex={1} minWidth={180}>
        <PickerSelect
          value={statusFilter}
          options={statusOptions}
          placeholder="Select status"
          onValueChange={(value) => onStatusChange(value as StatusFilter)}
        />
      </Field>
    </XStack>
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

function SaleEventList({
  ui,
  events,
  total,
  loading,
  isDesktop,
  onOpen,
  onEdit,
  onDelete,
}: {
  ui: AppUiTokens
  events: SaleEventWithCounts[]
  total: number
  loading: boolean
  isDesktop: boolean
  onOpen: (eventId: string) => void
  onEdit: (event: SaleEventWithCounts) => void
  onDelete: (event: SaleEventWithCounts) => void
}) {
  if (loading && events.length === 0) {
    return (
      <YStack minHeight={260} alignItems="center" justifyContent="center" gap="$2">
        <Spinner size="large" />
        <Text color={ui.textMuted}>Loading sale events…</Text>
      </YStack>
    )
  }

  if (!events.length) {
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
        <YStack width={56} height={56} borderRadius={999} backgroundColor={ui.surfaceMuted} alignItems="center" justifyContent="center">
          <Icons.BarChart3 size={26} color={ui.textMuted} />
        </YStack>
        <Text fontWeight="800" color={ui.text}>
          No sale events found
        </Text>
        <Text color={ui.textMuted} textAlign="center">
          Create your first campaign or adjust the filters above.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="800" color={ui.text}>
          All events
        </Text>
        <Text color={ui.textMuted}>
          {events.length} of {total}
        </Text>
      </XStack>

      <XStack flexWrap="wrap" gap="$3.5">
        {events.map((event) => (
          <SaleEventCard
            key={event.id}
            ui={ui}
            event={event}
            isDesktop={isDesktop}
            onOpen={() => onOpen(event.id)}
            onEdit={() => onEdit(event)}
            onDelete={() => onDelete(event)}
          />
        ))}
      </XStack>
    </YStack>
  )
}

function SaleEventCard({
  ui,
  event,
  isDesktop,
  onOpen,
  onEdit,
  onDelete,
}: {
  ui: AppUiTokens
  event: SaleEventWithCounts
  isDesktop: boolean
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const active = isEventActive(event)
  const expired = isEventExpired(event)

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
    >
      <YStack height={150} width="100%" position="relative" backgroundColor={ui.roseSurface}>
        {event.banner_image ? (
          <Image src={event.banner_image} width="100%" height="100%" objectFit="cover" alt={event.event_name} />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$1">
            <Icons.Image size={26} color={ui.brand} />
            <Text fontSize={12} color={ui.brand} fontWeight="600">
              No banner
            </Text>
          </YStack>
        )}
        <XStack position="absolute" top={10} left={10} gap="$1.5">
          <Badge tone={statusTone(event.status)} size="sm">
            {event.status}
          </Badge>
          {active ? (
            <Badge tone="success" size="sm">
              Live
            </Badge>
          ) : null}
        </XStack>
      </YStack>

      <YStack padding="$4" gap="$3">
        <YStack gap="$1.5">
          <Text fontWeight="800" fontSize={16} color={ui.text} numberOfLines={1}>
            {event.event_name || 'Untitled event'}
          </Text>
          <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
            /{event.event_slug}
          </Text>
          <XStack alignItems="center" gap="$1.5" marginTop="$1">
            <Icons.Calendar size={13} color={ui.textSecondary} />
            <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
              {formatEventDate(event.start_date)} → {formatEventDate(event.end_date)}
            </Text>
          </XStack>
          <Text fontSize={12} fontWeight="600" color={expired ? ui.error : ui.brand}>
            {getEventDurationLabel(event)}
          </Text>
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          <MiniStat ui={ui} icon={Icons.Tag} label="Offers" value={event.offer_count ?? 0} />
          <MiniStat ui={ui} icon={Icons.Users} label="Enrolled" value={event.enrollment_count ?? 0} />
          <MiniStat ui={ui} icon={Icons.CheckCircle} label="Accepted" value={event.accepted_count ?? 0} />
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <Button flex={1} size="$3" onPress={onOpen} icon={Icons.Eye}>
            Manage
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
// EVENT FORM (create / edit) — drawer
// ============================================================================

function EventFormSheet({
  ui,
  open,
  mode,
  form,
  busy,
  uploadingBanner,
  onOpenChange,
  onChange,
  onRemoveBanner,
  onSubmit,
}: {
  ui: AppUiTokens
  open: boolean
  mode: FormMode
  form: EventFormState
  busy: boolean
  uploadingBanner: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<EventFormState>) => void
  onRemoveBanner: () => void
  onSubmit: () => void
}) {
  const statusOptions = [
    { value: SALE_EVENT_STATUS.DRAFT, label: 'Draft' },
    { value: SALE_EVENT_STATUS.ACTIVE, label: 'Active' },
    { value: SALE_EVENT_STATUS.EXPIRED, label: 'Expired' },
  ]
  const currencyOptions = SALE_CURRENCY_CODES.map((code) => ({ value: code, label: code }))
  const canSubmit = !!form.event_name.trim() && !!form.event_slug.trim() && !!form.start_date && !!form.end_date

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Create sale event' : 'Edit sale event'}
      footer={
        <XStack gap="$2" justifyContent="flex-end">
          <Button tone="outline" onPress={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onPress={onSubmit} disabled={busy || !canSubmit}>
            {busy ? (uploadingBanner ? 'Uploading…' : 'Saving…') : mode === 'create' ? 'Create event' : 'Save changes'}
          </Button>
        </XStack>
      }
    >
      <YStack gap="$3.5">
        <Field label="Event name" required>
          <Input
            value={form.event_name}
            onChangeText={(event_name) =>
              onChange({
                event_name,
                ...(form.slugTouched ? {} : { event_slug: generateEventSlug(event_name) }),
              })
            }
            placeholder="Summer Mega Sale"
          />
        </Field>

        <Field label="Slug" required hint="Lowercase letters, numbers and hyphens. Used in the public URL.">
          <Input
            value={form.event_slug}
            onChangeText={(event_slug) => onChange({ event_slug, slugTouched: true })}
            placeholder="summer-mega-sale"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Description">
          <TextArea
            value={form.description}
            onChangeText={(description) => onChange({ description })}
            placeholder="What is this campaign about?"
            numberOfLines={4}
          />
        </Field>

        <BannerField
          ui={ui}
          bannerUrl={form.bannerUrl}
          bannerPick={form.bannerPick}
          uploading={uploadingBanner}
          onPick={(bannerPick) => onChange({ bannerPick })}
          onRemove={onRemoveBanner}
        />

        <XStack gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={200}>
            <DateTimeField
              ui={ui}
              label="Start date"
              required
              value={form.start_date}
              onChange={(start_date) => onChange({ start_date })}
            />
          </YStack>
          <YStack flex={1} minWidth={200}>
            <DateTimeField
              ui={ui}
              label="End date"
              required
              value={form.end_date}
              onChange={(end_date) => onChange({ end_date })}
            />
          </YStack>
        </XStack>

        <XStack gap="$3" flexWrap="wrap">
          <YStack flex={1} minWidth={200}>
            <DateTimeField
              ui={ui}
              label="Registration opens"
              hint="Optional — defaults to the event window."
              value={form.registration_start_date}
              onChange={(registration_start_date) => onChange({ registration_start_date })}
            />
          </YStack>
          <YStack flex={1} minWidth={200}>
            <DateTimeField
              ui={ui}
              label="Registration closes"
              hint="Optional."
              value={form.registration_end_date}
              onChange={(registration_end_date) => onChange({ registration_end_date })}
            />
          </YStack>
        </XStack>

        <XStack gap="$3" flexWrap="wrap">
          <Field label="Currency" flex={1} minWidth={150}>
            <PickerSelect
              value={form.currency}
              options={currencyOptions}
              placeholder="Currency"
              onValueChange={(currency) => onChange({ currency })}
            />
          </Field>
          <Field label="Status" flex={1} minWidth={150}>
            <PickerSelect
              value={form.status}
              options={statusOptions}
              placeholder="Status"
              onValueChange={(status) => onChange({ status: status as SaleEventStatus })}
            />
          </Field>
        </XStack>
      </YStack>
    </AppBottomSheet>
  )
}

function BannerField({
  ui,
  bannerUrl,
  bannerPick,
  uploading,
  onPick,
  onRemove,
}: {
  ui: AppUiTokens
  bannerUrl: string
  bannerPick: PickedImage[]
  uploading: boolean
  onPick: (images: PickedImage[]) => void
  onRemove: () => void
}) {
  const showCurrent = !!bannerUrl && bannerPick.length === 0

  return (
    <YStack gap="$2.5">
      {showCurrent ? (
        <YStack gap="$2">
          <Text fontSize={13} fontWeight="600" color={ui.text}>
            Current banner
          </Text>
          <YStack
            width="100%"
            height={150}
            borderRadius={radius.card}
            overflow="hidden"
            borderWidth={1}
            borderColor={ui.borderSubtle}
            position="relative"
          >
            <Image src={bannerUrl} width="100%" height="100%" objectFit="cover" alt="Current banner" />
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
              onPress={onRemove}
              aria-label="Remove banner"
            >
              <Icons.Trash2 size={16} color="white" />
            </YStack>
          </YStack>
        </YStack>
      ) : null}

      <ImageUploadField
        label={showCurrent ? 'Replace banner' : 'Banner image'}
        hint={`Recommended ${SALE_BANNER_SPECS.desktop.hint} (desktop) or ${SALE_BANNER_SPECS.mobile.hint} (mobile). Max 5 MB.`}
        value={bannerPick}
        onChange={onPick}
        disabled={uploading}
        accept="image"
      />
    </YStack>
  )
}

function DateTimeField({
  ui,
  label,
  value,
  onChange,
  required,
  hint,
}: {
  ui: AppUiTokens
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  hint?: string
}) {
  if (Platform.OS === 'web') {
    return (
      <Field label={label} required={required} hint={hint}>
        {/* Native datetime-local gives admins a reliable calendar/clock picker on web. */}
        <input
          type="datetime-local"
          value={value}
          onChange={(nativeEvent) => onChange((nativeEvent.target as HTMLInputElement).value)}
          style={{
            height: 44,
            width: '100%',
            boxSizing: 'border-box',
            borderRadius: 12,
            border: `1px solid ${ui.inputBorder}`,
            background: ui.inputBackground,
            color: ui.inputText,
            padding: '0 14px',
            fontSize: 15,
            fontWeight: 500,
            outline: 'none',
          }}
        />
      </Field>
    )
  }

  return (
    <Field label={label} required={required} hint={hint ?? 'Format: 2026-08-01T10:00'}>
      <Input value={value} onChangeText={onChange} placeholder="2026-08-01T10:00" autoCapitalize="none" />
    </Field>
  )
}

// ============================================================================
// EVENT DETAIL — drawer (offers + enrollments)
// ============================================================================

function EventDetailSheet({
  ui,
  open,
  isDesktop,
  event,
  offers,
  enrollments,
  loadingEnrollments,
  updatingEnrollment,
  savingOffer,
  onOpenChange,
  onEdit,
  onDelete,
  onCreateOffer,
  onDecideEnrollment,
}: {
  ui: AppUiTokens
  open: boolean
  isDesktop: boolean
  event: SaleEventDetail | null
  offers: EventOffer[]
  enrollments: SaleEnrollmentRow[]
  loadingEnrollments: boolean
  updatingEnrollment: boolean
  savingOffer: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onCreateOffer: (offer: NormalizedOfferInput) => Promise<boolean>
  onDecideEnrollment: (
    enrollmentId: string,
    status: typeof ENROLLMENT_STATUS.ACCEPTED | typeof ENROLLMENT_STATUS.REJECTED,
  ) => void
}) {
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [offerForm, setOfferForm] = useState<OfferFormState>(EMPTY_OFFER)

  useEffect(() => {
    if (!open) {
      setShowOfferForm(false)
      setOfferForm(EMPTY_OFFER)
    }
  }, [open])

  async function submitOffer() {
    if (!offerForm.offer_name.trim() || !offerForm.discount_value.trim()) return
    const ok = await onCreateOffer({
      offer_name: offerForm.offer_name.trim(),
      discount_type: offerForm.discount_type,
      discount_value: offerForm.discount_value,
      applies_to: offerForm.applies_to,
      min_order_amount: offerForm.min_order_amount || '0',
      max_discount_amount: offerForm.max_discount_amount || null,
      max_uses_total: offerForm.max_uses_total || null,
      max_uses_per_customer: offerForm.max_uses_per_customer || '1',
    })
    if (ok) {
      setOfferForm(EMPTY_OFFER)
      setShowOfferForm(false)
    }
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={event?.event_name ?? 'Sale event'}
      footer={
        <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
          <Button tone="outline" icon={Icons.Pencil} onPress={onEdit} disabled={!event}>
            Edit event
          </Button>
          <Button tone="destructive" icon={Icons.Trash2} onPress={onDelete} disabled={!event}>
            Delete
          </Button>
        </XStack>
      }
    >
      {!event ? (
        <YStack minHeight={200} alignItems="center" justifyContent="center" gap="$2">
          <Spinner size="large" />
          <Text color={ui.textMuted}>Loading event…</Text>
        </YStack>
      ) : (
        <YStack gap="$4">
          {event.banner_image ? (
            <YStack width="100%" height={isDesktop ? 200 : 150} borderRadius={radius.card} overflow="hidden">
              <Image src={event.banner_image} width="100%" height="100%" objectFit="cover" alt={event.event_name} />
            </YStack>
          ) : null}

          <XStack gap="$2" flexWrap="wrap" alignItems="center">
            <Badge tone={statusTone(event.status)}>{event.status}</Badge>
            <Badge tone="neutral">{getEventDurationLabel(event)}</Badge>
            <Badge tone="info">{getCurrencySymbol(event.currency)} {event.currency}</Badge>
          </XStack>

          {event.description ? (
            <Text color={ui.textSecondary} lineHeight={21}>
              {event.description}
            </Text>
          ) : null}

          <DetailPanel ui={ui} title="Schedule" icon={Icons.Calendar}>
            <DetailRow ui={ui} label="Starts" value={formatEventDate(event.start_date)} />
            <DetailRow ui={ui} label="Ends" value={formatEventDate(event.end_date)} />
            <DetailRow ui={ui} label="Registration opens" value={formatEventDate(event.registration_start_date)} />
            <DetailRow ui={ui} label="Registration closes" value={formatEventDate(event.registration_end_date)} />
          </DetailPanel>

          {/* OFFERS */}
          <DetailPanel
            ui={ui}
            title={`Offers (${offers.length})`}
            icon={Icons.Tag}
            action={
              <Button size="$2.5" tone={showOfferForm ? 'ghost' : 'outline'} onPress={() => setShowOfferForm((v) => !v)}>
                {showOfferForm ? 'Close' : 'Add offer'}
              </Button>
            }
          >
            {showOfferForm ? (
              <OfferForm
                ui={ui}
                form={offerForm}
                busy={savingOffer}
                onChange={(patch) => setOfferForm((current) => ({ ...current, ...patch }))}
                onSubmit={submitOffer}
              />
            ) : null}

            {offers.length === 0 && !showOfferForm ? (
              <Text color={ui.textMuted}>No offers yet. Add one so vendors know the deal.</Text>
            ) : (
              offers.map((offer) => (
                <XStack
                  key={offer.id}
                  gap="$3"
                  padding="$3"
                  borderRadius={radius.chip}
                  borderWidth={1}
                  borderColor={ui.borderSubtle}
                  backgroundColor={ui.surface}
                  alignItems="center"
                >
                  <YStack flex={1} minWidth={0} gap="$1">
                    <Text fontWeight="700" color={ui.text} numberOfLines={1}>
                      {offer.offer_name}
                    </Text>
                    <XStack gap="$1.5" flexWrap="wrap">
                      <Badge tone="brand" size="sm">
                        {formatDiscountLabel(offer.discount_type, offer.discount_value, offer.currency)}
                      </Badge>
                      <Badge tone="neutral" size="sm">
                        {offer.applies_to}
                      </Badge>
                    </XStack>
                  </YStack>
                  <YStack alignItems="flex-end">
                    <Text fontSize={11} color={ui.textMuted}>
                      Min {getCurrencySymbol(offer.currency)}
                      {offer.min_order_amount ?? 0}
                    </Text>
                    <Text fontSize={11} color={ui.textMuted}>
                      {offer.max_uses_total ? `${offer.max_uses_total} uses` : 'Unlimited'}
                    </Text>
                  </YStack>
                </XStack>
              ))
            )}
          </DetailPanel>

          {/* ENROLLMENTS */}
          <DetailPanel ui={ui} title={`Vendor enrollments (${enrollments.length})`} icon={Icons.Users}>
            {loadingEnrollments ? (
              <XStack gap="$2" alignItems="center">
                <Spinner size="small" />
                <Text color={ui.textMuted}>Loading enrollments…</Text>
              </XStack>
            ) : enrollments.length === 0 ? (
              <Text color={ui.textMuted}>No vendors have enrolled yet.</Text>
            ) : (
              enrollments.map((enrollment) => (
                <EnrollmentRow
                  key={enrollment.id}
                  ui={ui}
                  enrollment={enrollment}
                  busy={updatingEnrollment}
                  onDecide={onDecideEnrollment}
                />
              ))
            )}
          </DetailPanel>
        </YStack>
      )}
    </AppBottomSheet>
  )
}

type NormalizedOfferInput = {
  offer_name: string
  discount_type: string
  discount_value: string
  applies_to: string
  min_order_amount: string
  max_discount_amount: string | null
  max_uses_total: string | null
  max_uses_per_customer: string
}

function OfferForm({
  ui,
  form,
  busy,
  onChange,
  onSubmit,
}: {
  ui: AppUiTokens
  form: OfferFormState
  busy: boolean
  onChange: (patch: Partial<OfferFormState>) => void
  onSubmit: () => void
}) {
  const discountOptions = [
    { value: DISCOUNT_TYPE.PERCENTAGE, label: 'Percentage (%)' },
    { value: DISCOUNT_TYPE.FIXED, label: 'Fixed amount' },
  ]
  const appliesOptions = [
    { value: OFFER_APPLIES_TO.ORDER, label: 'Whole order' },
    { value: OFFER_APPLIES_TO.PRODUCT, label: 'Specific products' },
    { value: OFFER_APPLIES_TO.CATEGORY, label: 'Categories' },
  ]

  return (
    <YStack
      gap="$3"
      padding="$3.5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surfaceMuted}
    >
      <Field label="Offer name" required>
        <Input value={form.offer_name} onChangeText={(offer_name) => onChange({ offer_name })} placeholder="Flat 20% off" />
      </Field>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Discount type" flex={1} minWidth={160}>
          <PickerSelect
            value={form.discount_type}
            options={discountOptions}
            placeholder="Type"
            onValueChange={(discount_type) => onChange({ discount_type })}
          />
        </Field>
        <Field label="Discount value" flex={1} minWidth={140} required>
          <Input
            value={form.discount_value}
            onChangeText={(discount_value) => onChange({ discount_value })}
            placeholder={form.discount_type === DISCOUNT_TYPE.PERCENTAGE ? '20' : '100'}
            keyboardType="numeric"
          />
        </Field>
      </XStack>
      <Field label="Applies to">
        <PickerSelect
          value={form.applies_to}
          options={appliesOptions}
          placeholder="Applies to"
          onValueChange={(applies_to) => onChange({ applies_to })}
        />
      </Field>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Min order amount" flex={1} minWidth={140}>
          <Input
            value={form.min_order_amount}
            onChangeText={(min_order_amount) => onChange({ min_order_amount })}
            placeholder="0"
            keyboardType="numeric"
          />
        </Field>
        <Field label="Max discount amount" flex={1} minWidth={140}>
          <Input
            value={form.max_discount_amount}
            onChangeText={(max_discount_amount) => onChange({ max_discount_amount })}
            placeholder="Optional"
            keyboardType="numeric"
          />
        </Field>
      </XStack>
      <XStack gap="$3" flexWrap="wrap">
        <Field label="Max uses (total)" flex={1} minWidth={140}>
          <Input
            value={form.max_uses_total}
            onChangeText={(max_uses_total) => onChange({ max_uses_total })}
            placeholder="Unlimited"
            keyboardType="numeric"
          />
        </Field>
        <Field label="Max uses per customer" flex={1} minWidth={140}>
          <Input
            value={form.max_uses_per_customer}
            onChangeText={(max_uses_per_customer) => onChange({ max_uses_per_customer })}
            placeholder="1"
            keyboardType="numeric"
          />
        </Field>
      </XStack>
      <XStack justifyContent="flex-end">
        <Button
          size="$3"
          onPress={onSubmit}
          disabled={busy || !form.offer_name.trim() || !form.discount_value.trim()}
        >
          {busy ? 'Saving…' : 'Save offer'}
        </Button>
      </XStack>
    </YStack>
  )
}

function EnrollmentRow({
  ui,
  enrollment,
  busy,
  onDecide,
}: {
  ui: AppUiTokens
  enrollment: SaleEnrollmentRow
  busy: boolean
  onDecide: (
    enrollmentId: string,
    status: typeof ENROLLMENT_STATUS.ACCEPTED | typeof ENROLLMENT_STATUS.REJECTED,
  ) => void
}) {
  const shop = enrollment.shops ?? null
  const pending = enrollment.enrollment_status === ENROLLMENT_STATUS.PENDING
  const tone =
    enrollment.enrollment_status === ENROLLMENT_STATUS.ACCEPTED
      ? 'success'
      : enrollment.enrollment_status === ENROLLMENT_STATUS.REJECTED
        ? 'danger'
        : 'warning'

  return (
    <XStack
      gap="$3"
      padding="$3"
      borderRadius={radius.chip}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      alignItems="center"
    >
      {shop?.logo_url ? (
        <Image src={shop.logo_url} width={40} height={40} borderRadius={radius.chip} />
      ) : (
        <YStack width={40} height={40} borderRadius={radius.chip} backgroundColor={ui.surfaceMuted} alignItems="center" justifyContent="center">
          <Icons.Store size={18} color={ui.textMuted} />
        </YStack>
      )}
      <YStack flex={1} minWidth={0} gap="$1">
        <Text fontWeight="700" color={ui.text} numberOfLines={1}>
          {shop?.shop_name ?? 'Vendor shop'}
        </Text>
        <Badge tone={tone} size="sm">
          {getEnrollmentStatusLabel(enrollment.enrollment_status)}
        </Badge>
      </YStack>
      {pending ? (
        <XStack gap="$1.5">
          <Button size="$2.5" onPress={() => onDecide(enrollment.id, ENROLLMENT_STATUS.ACCEPTED)} disabled={busy} icon={Icons.Check}>
            Accept
          </Button>
          <Button size="$2.5" tone="outline" onPress={() => onDecide(enrollment.id, ENROLLMENT_STATUS.REJECTED)} disabled={busy}>
            Reject
          </Button>
        </XStack>
      ) : null}
    </XStack>
  )
}

// ============================================================================
// CONFIRM DELETE — drawer
// ============================================================================

function ConfirmDeleteSheet({
  ui,
  event,
  busy,
  onCancel,
  onConfirm,
}: {
  ui: AppUiTokens
  event: SaleEventWithCounts | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AppBottomSheet
      open={!!event}
      onOpenChange={(open) => (!open ? onCancel() : undefined)}
      title="Delete sale event?"
      scrollable={false}
      footer={
        <XStack gap="$2" justifyContent="flex-end">
          <Button tone="outline" onPress={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button tone="destructive" onPress={onConfirm} disabled={busy} icon={Icons.Trash2}>
            {busy ? 'Deleting…' : 'Delete event'}
          </Button>
        </XStack>
      }
    >
      <YStack gap="$2">
        <Text color={ui.text} fontWeight="700" fontSize={16}>
          {event?.event_name}
        </Text>
        <Text color={ui.textSecondary} lineHeight={21}>
          This permanently removes the event along with its offers and vendor enrollments. This action
          cannot be undone.
        </Text>
      </YStack>
    </AppBottomSheet>
  )
}

// ============================================================================
// SHARED DETAIL PRIMITIVES
// ============================================================================

function DetailPanel({
  ui,
  title,
  icon: Icon,
  action,
  children,
}: {
  ui: AppUiTokens
  title: string
  icon: (typeof Icons)[keyof typeof Icons]
  action?: ReactNode
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
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
          <Icon size={16} color={ui.brand} />
          <Text fontWeight="800" color={ui.text}>
            {title}
          </Text>
        </XStack>
        {action}
      </XStack>
      <YStack gap="$2.5">{children}</YStack>
    </YStack>
  )
}

function DetailRow({ ui, label, value }: { ui: AppUiTokens; label: string; value: string }) {
  return (
    <XStack gap="$3" justifyContent="space-between" alignItems="flex-start">
      <Text flex={1} color={ui.textMuted} fontSize={13}>
        {label}
      </Text>
      <Text flex={1.4} color={ui.text} fontSize={13} fontWeight="600" textAlign="right">
        {value}
      </Text>
    </XStack>
  )
}
