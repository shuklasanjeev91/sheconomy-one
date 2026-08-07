import { useEffect, useMemo, useState } from 'react'

import {
  Badge,
  Button,
  Field,
  Icons,
  Image,
  Input,
  Spinner,
  Text,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { ImageUploadField } from '~/components/media/ImageUploadField'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  CMS_MEDIA_TYPES,
  deleteMedia,
  loadMedia,
  uploadMedia,
  type CmsMedia,
  type CmsMediaType,
} from '~/lib/cms'
import { pickedImageToBlob, type PickedImage } from '~/lib/media/pick-image'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CmsInlineConfirm, CmsPageShell, CmsPanel, CmsPickerSelect } from './CmsPageShell'

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: CMS_MEDIA_TYPES.IMAGE, label: 'Images' },
  { value: CMS_MEDIA_TYPES.VIDEO, label: 'Videos' },
  { value: CMS_MEDIA_TYPES.DOCUMENT, label: 'Documents' },
  { value: CMS_MEDIA_TYPES.AUDIO, label: 'Audio' },
  { value: CMS_MEDIA_TYPES.OTHER, label: 'Other' },
]

function mediaTypeTone(type: string) {
  if (type === 'image') return 'info' as const
  if (type === 'video') return 'brand' as const
  return 'neutral' as const
}

export function AdminCmsMediaPage() {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  const { mediaItems, mediaMeta, isFetching, isUploading, isDeleting, mediaError } = useAppSelector(
    (s) => s.cms,
  )

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [uploadPick, setUploadPick] = useState<PickedImage[]>([])
  const [pendingDelete, setPendingDelete] = useState<CmsMedia | null>(null)

  useEffect(() => {
    refresh()
  }, [dispatch])

  function refresh(overrides: { page?: number; media_type?: CmsMediaType } = {}) {
    void dispatch(
      loadMedia({
        page: overrides.page ?? 1,
        limit: 30,
        media_type:
          typeFilter === 'all'
            ? overrides.media_type
            : (typeFilter as CmsMediaType),
      }),
    )
  }

  useEffect(() => {
    refresh({ page: 1 })
  }, [typeFilter])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return mediaItems
    return mediaItems.filter(
      (m) =>
        m.file_name.toLowerCase().includes(needle) ||
        (m.alt_text ?? '').toLowerCase().includes(needle) ||
        (m.caption ?? '').toLowerCase().includes(needle),
    )
  }, [mediaItems, search])

  async function handleUploadPickChange(picks: PickedImage[]) {
    setUploadPick(picks)
    const picked = picks[picks.length - 1]
    if (!picked) return
    try {
      const blob = await pickedImageToBlob(picked)
      const file = {
        blob,
        mimeType: picked.mimeType || blob.type || 'image/jpeg',
        fileName: picked.fileName || `cms-${Date.now()}.jpg`,
        fileSize: picked.file?.size ?? blob.size,
      }
      await dispatch(uploadMedia({ file, options: { folder: '/uploads' } })).unwrap()
      toast.show('Media uploaded', { tone: 'success' })
      setUploadPick([])
      refresh({ page: 1 })
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Upload failed', { tone: 'danger' })
      setUploadPick([])
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await dispatch(deleteMedia(pendingDelete.id)).unwrap()
      toast.show('Media deleted', { tone: 'success' })
      setPendingDelete(null)
      refresh({ page: mediaMeta.page })
    } catch (err) {
      toast.show(typeof err === 'string' ? err : 'Delete failed', { tone: 'danger' })
    }
  }

  return (
    <CmsPageShell
      title="Media"
      subtitle="Upload and manage CMS media assets."
    >
      <CmsPanel>
        <YStack gap="$3">
          <XStack gap="$2" flexWrap="wrap" alignItems="flex-end">
            <Field label="Search" flex={1} minWidth={200}>
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder="Search file name, alt text…"
              />
            </Field>
            <Field label="Type" minWidth={isDesktop ? 160 : '100%'}>
              <CmsPickerSelect
                value={typeFilter}
                options={TYPE_OPTIONS}
                placeholder="Type"
                onValueChange={setTypeFilter}
              />
            </Field>
            <Button size="$3" tone="outline" icon={Icons.RefreshCw} onPress={() => refresh()} />
          </XStack>

          <ImageUploadField
            label="Upload image"
            hint="Images are stored in the cms-media bucket."
            value={uploadPick}
            onChange={(picks) => void handleUploadPickChange(picks)}
            uploadProgress={isUploading ? 50 : null}
            disabled={isUploading}
          />
        </YStack>
      </CmsPanel>

      {pendingDelete ? (
        <CmsInlineConfirm
          title="Delete media?"
          description={`“${pendingDelete.file_name}” will be permanently removed.`}
          confirmLabel="Delete"
          loading={isDeleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      {mediaError ? <Text color={ui.error}>{mediaError}</Text> : null}

      <CmsPanel gap="$2">
        {isFetching && filtered.length === 0 ? (
          <YStack minHeight={200} alignItems="center" justifyContent="center" gap="$2">
            <Spinner size="large" />
            <Text color={ui.textMuted}>Loading media…</Text>
          </YStack>
        ) : filtered.length === 0 ? (
          <Text color={ui.textMuted}>No media found.</Text>
        ) : (
          <XStack gap="$2" flexWrap="wrap">
            {filtered.map((item) => (
              <YStack
                key={item.id}
                width={isDesktop ? 180 : '46%'}
                gap="$2"
                padding="$2"
                borderRadius={radius.card}
                borderWidth={1}
                borderColor={ui.borderSubtle}
                backgroundColor={ui.surfaceMuted}
              >
                {item.public_url && item.media_type === 'image' ? (
                  <Image
                    source={{ uri: item.public_url }}
                    width="100%"
                    height={110}
                    borderRadius={8}
                    resizeMode="cover"
                    alt={item.alt_text ?? item.file_name}
                  />
                ) : (
                  <YStack
                    height={110}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor={ui.surface}
                    borderRadius={8}
                  >
                    <Icons.FileText size={28} color={ui.textMuted} />
                  </YStack>
                )}
                <XStack gap="$1" flexWrap="wrap">
                  <Badge tone={mediaTypeTone(item.media_type)}>{item.media_type}</Badge>
                </XStack>
                <Text fontSize={12} fontWeight="700" color={ui.text} numberOfLines={2}>
                  {item.file_name}
                </Text>
                <Text fontSize={11} color={ui.textMuted}>
                  {(item.file_size / 1024).toFixed(1)} KB
                </Text>
                <Button size="$2" tone="outline" onPress={() => setPendingDelete(item)}>
                  Delete
                </Button>
              </YStack>
            ))}
          </XStack>
        )}

        {mediaMeta.totalPages > 1 ? (
          <XStack justifyContent="space-between" alignItems="center" paddingTop="$2">
            <Text fontSize={13} color={ui.textMuted}>
              Page {mediaMeta.page} of {mediaMeta.totalPages}
            </Text>
            <XStack gap="$2">
              <Button
                size="$2"
                tone="outline"
                disabled={!mediaMeta.hasPrevPage || isFetching}
                onPress={() => refresh({ page: mediaMeta.page - 1 })}
              >
                Previous
              </Button>
              <Button
                size="$2"
                tone="outline"
                disabled={!mediaMeta.hasNextPage || isFetching}
                onPress={() => refresh({ page: mediaMeta.page + 1 })}
              >
                Next
              </Button>
            </XStack>
          </XStack>
        ) : null}
      </CmsPanel>
    </CmsPageShell>
  )
}
