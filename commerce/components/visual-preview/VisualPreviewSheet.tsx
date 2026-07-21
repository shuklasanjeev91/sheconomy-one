import { useMemo, useState } from 'react'
import { useRouter } from 'one'

import {
  AppBottomSheet,
  Button,
  Icons,
  Image,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { ShareButton } from '~/components/share'
import {
  requestTryOn,
  requestViewInSpace,
} from '~/lib/commerce/visual-preview.client'
import type {
  VisualPreviewMode,
  VisualPreviewPlacement,
} from '~/lib/listing/visual-preview'
import { captureImage, pickImages, type PickedImage } from '~/lib/media/pick-image'
import { appRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

type VisualPreviewSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: VisualPreviewMode
  listingId: string
  listingTitle: string
  listingImageUrl?: string | null
  listingShareUrl?: string | null
}

const PLACEMENTS: Array<{ id: VisualPreviewPlacement; label: string }> = [
  { id: 'wall', label: 'Wall' },
  { id: 'floor', label: 'Floor' },
  { id: 'table', label: 'Table' },
]

export function VisualPreviewSheet({
  open,
  onOpenChange,
  mode,
  listingId,
  listingTitle,
  listingImageUrl,
  listingShareUrl,
}: VisualPreviewSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()

  const [picked, setPicked] = useState<PickedImage | null>(null)
  const [placement, setPlacement] = useState<VisualPreviewPlacement>('wall')
  const [busy, setBusy] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  const title = mode === 'try_on' ? 'Try it on' : 'View in your room'
  const guidance =
    mode === 'try_on'
      ? 'Upload a clear full-body or torso photo. Results are AI visualizations, not an exact fit guarantee.'
      : 'Upload a photo of your wall or room. Results are AI visualizations — scale may not be exact.'

  const previewUri = useMemo(() => picked?.uri ?? null, [picked])

  function resetFlow() {
    setPicked(null)
    setResultUrl(null)
    setBusy(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetFlow()
    onOpenChange(next)
  }

  async function ensureSignedIn() {
    if (user?.id) return true
    handleOpenChange(false)
    router.push(appRoutes.signIn)
    return false
  }

  async function handlePickGallery() {
    if (!(await ensureSignedIn())) return
    const images = await pickImages({ multiple: false, maxCount: 1 })
    if (images[0]) {
      setResultUrl(null)
      setPicked(images[0])
    }
  }

  async function handleCapture() {
    if (!(await ensureSignedIn())) return
    const image = await captureImage()
    if (image) {
      setResultUrl(null)
      setPicked(image)
    }
  }

  async function handleGenerate() {
    if (!(await ensureSignedIn()) || !user?.id) return
    if (!picked) {
      toast.show('Add a photo first', { tone: 'danger' })
      return
    }

    setBusy(true)
    try {
      const result =
        mode === 'try_on'
          ? await requestTryOn({
              userId: user.id,
              listingId,
              userImage: picked,
            })
          : await requestViewInSpace({
              userId: user.id,
              listingId,
              spaceImage: picked,
              placement,
            })
      setResultUrl(result.resultUrl)
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not generate preview', {
        tone: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppBottomSheet open={open} onOpenChange={handleOpenChange} title={title} scrollable>
      <YStack gap="$4" paddingHorizontal="$4" paddingBottom="$4">
        <Text fontSize={13} color={ui.textSecondary} lineHeight={18}>
          {guidance}
        </Text>

        {mode === 'view_in_space' ? (
          <XStack gap="$2" flexWrap="wrap">
            {PLACEMENTS.map((option) => {
              const active = placement === option.id
              return (
                <Button
                  key={option.id}
                  size="$3"
                  tone={active ? 'primary' : 'outline'}
                  onPress={() => setPlacement(option.id)}
                  disabled={busy}
                >
                  {option.label}
                </Button>
              )
            })}
          </XStack>
        ) : null}

        <XStack gap="$2" flexWrap="wrap">
          <Button
            size="$3"
            tone="outline"
            icon={<Icons.Image size={16} />}
            onPress={() => void handlePickGallery()}
            disabled={busy}
          >
            Gallery
          </Button>
          <Button
            size="$3"
            tone="outline"
            icon={<Icons.Camera size={16} />}
            onPress={() => void handleCapture()}
            disabled={busy}
          >
            Camera
          </Button>
        </XStack>

        {(previewUri || listingImageUrl) && !resultUrl ? (
          <XStack gap="$3" flexWrap="wrap">
            {previewUri ? (
              <YStack gap="$1.5" flex={1} minWidth={140}>
                <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
                  Your photo
                </Text>
                <YStack width="100%" aspectRatio={3 / 4} borderRadius={12} overflow="hidden" backgroundColor={ui.surfaceMuted}>
                  <Image source={{ uri: previewUri }} width="100%" height="100%" objectFit="cover" />
                </YStack>
              </YStack>
            ) : null}
            {listingImageUrl ? (
              <YStack gap="$1.5" flex={1} minWidth={140}>
                <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
                  Product
                </Text>
                <YStack width="100%" aspectRatio={3 / 4} borderRadius={12} overflow="hidden" backgroundColor={ui.surfaceMuted}>
                  <Image source={{ uri: listingImageUrl }} width="100%" height="100%" objectFit="cover" />
                </YStack>
              </YStack>
            ) : null}
          </XStack>
        ) : null}

        {resultUrl ? (
          <YStack gap="$3">
            <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
              AI preview
            </Text>
            <YStack width="100%" aspectRatio={3 / 4} borderRadius={16} overflow="hidden" backgroundColor={ui.surfaceMuted}>
              <Image source={{ uri: resultUrl }} width="100%" height="100%" objectFit="cover" />
            </YStack>
            <XStack gap="$2" flexWrap="wrap">
              <Button size="$3" tone="outline" onPress={resetFlow} disabled={busy}>
                Try again
              </Button>
              {listingShareUrl ? (
                <ShareButton
                  payload={{
                    url: listingShareUrl,
                    title: listingTitle,
                    text:
                      mode === 'try_on'
                        ? `I tried on ${listingTitle} with SHEconomy AI`
                        : `I previewed ${listingTitle} in my space with SHEconomy AI`,
                  }}
                  label="Share listing"
                  size="$3"
                />
              ) : null}
            </XStack>
          </YStack>
        ) : (
          <Button
            onPress={() => void handleGenerate()}
            disabled={busy || !picked}
            icon={busy ? <Spinner size="small" /> : <Icons.Sparkles size={16} />}
          >
            {busy ? 'Generating…' : mode === 'try_on' ? 'Generate try-on' : 'Place in photo'}
          </Button>
        )}
      </YStack>
    </AppBottomSheet>
  )
}
