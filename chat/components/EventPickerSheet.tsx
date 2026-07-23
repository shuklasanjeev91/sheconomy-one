import { useEffect, useMemo, useState } from 'react'

import { ScreenSearchField } from '~/components/search'
import { SHEET_SEARCH_MIN_ITEMS, filterBySearchQuery } from '~/lib/search'

import { useChatTheme } from '~/chat/lib/chat-theme'
import type { ChatEventPayload } from '~/chat/lib/types'
import { createEvent, fetchUpcomingEvents, type CommunityEvent } from '~/community/lib/events'
import {
  AppBottomSheet,
  Icons,
  Image,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { pickImages, pickedImageToBlob, type PickedImage } from '~/lib/media/pick-image'
import { uploadEventCoverImage } from '~/lib/supabase/storage-upload'
import { MediaDropZone } from '~/components/media/MediaDropZone'
import { UploadProgressBar } from '~/components/media/UploadProgressBar'
import { useUploadProgress } from '~/hooks/useUploadProgress'

type EventPickerSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string | null
  onPick: (event: ChatEventPayload) => void
}

type Mode = 'pick' | 'create'

function toPayload(event: CommunityEvent): ChatEventPayload {
  return {
    eventId: event.id,
    title: event.title,
    startTime: event.start_time,
    location: event.location ?? event.meeting_url ?? null,
    imageUrl: event.image_url ?? null,
  }
}

function formatWhen(startTime: string | null): string {
  if (!startTime) return ''
  const date = new Date(startTime)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Bottom sheet to share an existing community event or create a new one in chat. */
export function EventPickerSheet({ open, onOpenChange, currentUserId, onPick }: EventPickerSheetProps) {
  const chat = useChatTheme()
  const toast = useAppToast()
  const [mode, setMode] = useState<Mode>('pick')
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [cover, setCover] = useState<PickedImage | null>(null)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const { progress: uploadProgress, track: trackUpload, reset: resetUpload } = useUploadProgress()
  const filteredEvents = useMemo(
    () =>
      filterBySearchQuery(events, query, (event) => [
        event.title,
        event.location,
        event.meeting_url,
        formatWhen(event.start_time),
      ]),
    [events, query],
  )

  useEffect(() => {
    if (!open) return
    setMode('pick')
    setQuery('')
    setLoading(true)
    fetchUpcomingEvents(0).then((result) => {
      setEvents(result.items)
      setLoading(false)
    })
  }, [open])

  function resetCreate() {
    setTitle('')
    setDate('')
    setTime('')
    setLocation('')
    setCover(null)
  }

  async function handlePickCover() {
    if (picking) return
    setPicking(true)
    try {
      const picked = await pickImages({ multiple: false, maxCount: 1 })
      if (picked[0]) setCover(picked[0])
    } catch {
      toast.show('Could not add photo', { tone: 'danger' })
    } finally {
      setPicking(false)
    }
  }

  const canCreate = title.trim().length > 0 && date.trim().length > 0 && time.trim().length > 0

  async function handleCreate() {
    if (!currentUserId || !canCreate || saving) return
    const startIso = new Date(`${date}T${time}`)
    if (Number.isNaN(startIso.getTime())) {
      toast.show('Enter a valid date and time', { tone: 'danger' })
      return
    }
    setSaving(true)

    let imageUrl: string | undefined
    if (cover) {
      const blob = await pickedImageToBlob(cover)
      trackUpload(1)
      const { data: uploaded, error: uploadError } = await uploadEventCoverImage(
        currentUserId,
        {
          blob,
          mimeType: cover.mimeType || blob.type || 'image/jpeg',
          fileName: cover.fileName,
        },
        { onProgress: trackUpload },
      )
      if (uploadError || !uploaded) {
        setSaving(false)
        resetUpload()
        toast.show('Could not upload cover image', { tone: 'danger', message: uploadError ?? undefined })
        return
      }
      imageUrl = uploaded.publicUrl
    }

    const { data, error } = await createEvent(currentUserId, {
      title: title.trim(),
      startTime: startIso.toISOString(),
      isOnline: false,
      location: location.trim() || undefined,
      imageUrl,
      isFree: true,
    })
    setSaving(false)
    resetUpload()
    if (error || !data) {
      toast.show('Could not create event', { tone: 'danger', message: error ?? undefined })
      return
    }
    onPick(toPayload(data))
    resetCreate()
    onOpenChange(false)
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Share an event" scrollable={false}>
      <YStack gap={12} paddingBottom={8}>
        <XStack gap={8}>
          <ModeTab label="Upcoming" active={mode === 'pick'} onPress={() => setMode('pick')} />
          <ModeTab label="New event" active={mode === 'create'} onPress={() => setMode('create')} />
        </XStack>

        {mode === 'pick' ? (
          <>
            {events.length >= SHEET_SEARCH_MIN_ITEMS || query.length > 0 ? (
              <ScreenSearchField
                value={query}
                onChangeText={setQuery}
                placeholder="Search events"
                clearable
              />
            ) : null}
            {loading ? (
            <XStack paddingVertical={20} justifyContent="center">
              <Spinner color={chat.brand} />
            </XStack>
          ) : events.length === 0 ? (
            <YStack paddingVertical={20} alignItems="center" gap={6}>
              <Icons.Calendar size={26} color={chat.textMuted} />
              <Text fontSize={14} color={chat.textMuted}>
                No upcoming events. Create one instead.
              </Text>
            </YStack>
          ) : filteredEvents.length === 0 ? (
            <YStack paddingVertical={20} alignItems="center" gap={6}>
              <Icons.Search size={26} color={chat.textMuted} />
              <Text fontSize={14} color={chat.textMuted}>
                No events match your search.
              </Text>
            </YStack>
          ) : (
            <YStack gap={6} maxHeight={320}>
              {filteredEvents.map((event) => (
                <XStack
                  key={event.id}
                  onPress={() => {
                    onPick(toPayload(event))
                    onOpenChange(false)
                  }}
                  cursor="pointer"
                  gap={10}
                  alignItems="center"
                  paddingVertical={10}
                  paddingHorizontal={8}
                  borderRadius={10}
                  hoverStyle={{ backgroundColor: chat.listItemHover }}
                  pressStyle={{ backgroundColor: chat.listItemActive }}
                  animation="quick"
                >
                  <YStack
                    width={38}
                    height={38}
                    borderRadius={10}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor={chat.reactionBg}
                  >
                    <Icons.Calendar size={19} color={chat.brand} />
                  </YStack>
                  <YStack flex={1} minWidth={0}>
                    <Text fontSize={15} fontWeight="600" color={chat.text} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text fontSize={12.5} color={chat.textMuted} numberOfLines={1}>
                      {[formatWhen(event.start_time), event.location].filter(Boolean).join(' · ')}
                    </Text>
                  </YStack>
                  <Icons.ChevronRight size={18} color={chat.textMuted} />
                </XStack>
              ))}
            </YStack>
          )}
          </>
        ) : (
          <YStack gap={10}>
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
              placeholderTextColor={chat.textMuted}
              color={chat.text}
              backgroundColor={chat.inputBg}
              borderColor={chat.border}
            />
            <XStack gap={8}>
              <Input
                flex={1}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={chat.textMuted}
                color={chat.text}
                backgroundColor={chat.inputBg}
                borderColor={chat.border}
              />
              <Input
                flex={1}
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM"
                placeholderTextColor={chat.textMuted}
                color={chat.text}
                backgroundColor={chat.inputBg}
                borderColor={chat.border}
              />
            </XStack>
            <Input
              value={location}
              onChangeText={setLocation}
              placeholder="Location or link (optional)"
              placeholderTextColor={chat.textMuted}
              color={chat.text}
              backgroundColor={chat.inputBg}
              borderColor={chat.border}
            />

            <MediaDropZone
              disabled={picking || saving}
              accept="image"
              maxCount={1}
              label="Drop a cover image"
              onDrop={(items) => {
                if (items[0]) setCover(items[0])
              }}
            >
            {cover ? (
              <YStack borderRadius={12} overflow="hidden" position="relative">
                <Image src={cover.uri} width="100%" height={150} objectFit="cover" alt="" />
                <XStack
                  position="absolute"
                  top={8}
                  right={8}
                  width={30}
                  height={30}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="rgba(0,0,0,0.55)"
                  cursor="pointer"
                  onPress={() => setCover(null)}
                  aria-label="Remove cover image"
                >
                  <Icons.X size={16} color="white" />
                </XStack>
              </YStack>
            ) : (
              <XStack
                onPress={() => void handlePickCover()}
                cursor="pointer"
                alignItems="center"
                justifyContent="center"
                gap={8}
                height={46}
                borderRadius={12}
                borderWidth={1}
                borderStyle="dashed"
                borderColor={chat.border}
                backgroundColor={chat.inputBg}
                pressStyle={{ scale: 0.99 }}
                animation="quick"
              >
                {picking ? (
                  <Spinner size="small" color={chat.brand} />
                ) : (
                  <>
                    <Icons.Image size={18} color={chat.brand} />
                    <Text fontSize={14} fontWeight="600" color={chat.brand}>
                      Drop or add cover image
                    </Text>
                  </>
                )}
              </XStack>
            )}
            </MediaDropZone>

            {uploadProgress != null && uploadProgress > 0 ? (
              <UploadProgressBar progress={uploadProgress} label="Uploading cover…" compact />
            ) : null}

            <XStack
              onPress={canCreate ? () => void handleCreate() : undefined}
              cursor={canCreate ? 'pointer' : 'default'}
              alignItems="center"
              justifyContent="center"
              height={46}
              borderRadius={999}
              backgroundColor={canCreate ? chat.brand : chat.border}
              pressStyle={canCreate ? { scale: 0.98 } : undefined}
              animation="quick"
            >
              {saving ? (
                <Spinner size="small" color={chat.brandContrast} />
              ) : (
                <Text
                  fontSize={15}
                  fontWeight="700"
                  color={canCreate ? chat.brandContrast : chat.textMuted}
                >
                  Create & share
                </Text>
              )}
            </XStack>
          </YStack>
        )}
      </YStack>
    </AppBottomSheet>
  )
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const chat = useChatTheme()
  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      paddingHorizontal={14}
      paddingVertical={8}
      borderRadius={999}
      backgroundColor={active ? chat.brand : chat.inputBg}
      borderWidth={1}
      borderColor={active ? chat.brand : chat.border}
    >
      <Text fontSize={13.5} fontWeight="600" color={active ? chat.brandContrast : chat.textSecondary}>
        {label}
      </Text>
    </XStack>
  )
}
