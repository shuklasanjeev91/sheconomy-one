import { useEffect, useMemo, useState } from 'react'
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
import {
  VISUAL_PLACEMENT_OPTIONS,
  type VisualPreviewMode,
  type VisualPreviewPlacement,
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
  listingCategory?: string | null
  listingImageUrl?: string | null
  listingShareUrl?: string | null
  defaultPlacement?: VisualPreviewPlacement
}

export function VisualPreviewSheet({
  open,
  onOpenChange,
  mode,
  listingId,
  listingTitle,
  listingCategory,
  listingImageUrl,
  listingShareUrl,
  defaultPlacement = 'wall',
}: VisualPreviewSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const router = useRouter()
  const { user } = useSupabase()

  const [picked, setPicked] = useState<PickedImage | null>(null)
  const [placement, setPlacement] = useState<VisualPreviewPlacement>(defaultPlacement)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)

  useEffect(() => {
    if (open) setPlacement(defaultPlacement)
  }, [open, defaultPlacement])

  const isTryOn = mode === 'try_on'
  const title = isTryOn ? 'Try it on' : 'View in your room'
  const guidance = isTryOn
    ? 'Upload a clear full-body or torso selfie. We’ll show a preview of this fashion item on you — not an exact fit guarantee.'
    : 'Upload a photo of your wall or room, choose Wall / Floor / Table, and preview how this product looks in your space.'

  const previewUri = useMemo(() => picked?.uri ?? null, [picked])

  function resetFlow() {
    setPicked(null)
    setResultUrl(null)
    setBusy(false)
    setStatus(null)
    setErrorMessage(null)
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
      setErrorMessage(null)
      setPicked(images[0])
    }
  }

  async function handleCapture() {
    if (!(await ensureSignedIn())) return
    const image = await captureImage()
    if (image) {
      setResultUrl(null)
      setErrorMessage(null)
      setPicked(image)
    }
  }

  async function handleGenerate() {
    if (!(await ensureSignedIn()) || !user?.id) return
    if (!picked) {
      setErrorMessage('Add a photo first using Gallery or Camera.')
      toast.show('Add a photo first', { tone: 'danger' })
      return
    }

    setBusy(true)
    setErrorMessage(null)
    setStatus('Uploading your photo…')
    try {
      const result = isTryOn
        ? await requestTryOn({
            userId: user.id,
            listingId,
            userImage: picked,
            title: listingTitle,
            category: listingCategory,
            onStatus: setStatus,
          })
        : await requestViewInSpace({
            userId: user.id,
            listingId,
            spaceImage: picked,
            placement,
            title: listingTitle,
            category: listingCategory,
            onStatus: setStatus,
          })
      setStatus(null)
      setResultUrl(result.resultUrl)
      toast.show(isTryOn ? 'Try-on ready' : 'Room preview ready', { tone: 'success' })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not generate preview. Please try again.'
      setErrorMessage(message)
      setStatus(null)
      toast.show(message, { tone: 'danger' })
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

        {!isTryOn ? (
          <YStack gap="$2">
            <Text fontSize={12} fontWeight="700" color={ui.textMuted} textTransform="uppercase" letterSpacing={0.5}>
              Place on
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {VISUAL_PLACEMENT_OPTIONS.map((option) => {
                const active = placement === option.id
                return (
                  <Button
                    key={option.id}
                    size="$3"
                    tone={active ? 'primary' : 'outline'}
                    onPress={() => {
                      setPlacement(option.id)
                      setResultUrl(null)
                    }}
                    disabled={busy}
                  >
                    {option.label}
                  </Button>
                )
              })}
            </XStack>
            <Text fontSize={12} color={ui.textMuted}>
              {VISUAL_PLACEMENT_OPTIONS.find((option) => option.id === placement)?.hint}
            </Text>
          </YStack>
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

        {!resultUrl ? (
          <XStack gap="$3" flexWrap="wrap">
            <YStack gap="$1.5" flex={1} minWidth={140}>
              <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
                {isTryOn ? 'Your photo' : 'Your room'}
              </Text>
              <YStack
                width="100%"
                aspectRatio={3 / 4}
                borderRadius={12}
                overflow="hidden"
                backgroundColor={ui.surfaceMuted}
                position="relative"
                alignItems="center"
                justifyContent="center"
              >
                {previewUri ? (
                  <Image src={previewUri} alt="Your photo" width="100%" height="100%" objectFit="cover" />
                ) : (
                  <Text fontSize={12} color={ui.textMuted} textAlign="center" paddingHorizontal="$3">
                    Tap Gallery or Camera to add a photo
                  </Text>
                )}
              </YStack>
            </YStack>
            {listingImageUrl ? (
              <YStack gap="$1.5" flex={1} minWidth={140}>
                <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
                  Product
                </Text>
                <YStack
                  width="100%"
                  aspectRatio={3 / 4}
                  borderRadius={12}
                  overflow="hidden"
                  backgroundColor={ui.surfaceMuted}
                  position="relative"
                >
                  <Image
                    src={listingImageUrl}
                    alt={listingTitle}
                    width="100%"
                    height="100%"
                    objectFit="cover"
                  />
                </YStack>
              </YStack>
            ) : null}
          </XStack>
        ) : null}

        {busy || status ? (
          <XStack
            alignItems="center"
            gap="$2"
            padding="$3"
            borderRadius={12}
            backgroundColor={ui.surfaceMuted}
            borderWidth={1}
            borderColor={ui.borderSubtle}
          >
            <Spinner size="small" color={ui.brand} />
            <Text fontSize={13} color={ui.text} flex={1}>
              {status || 'Working…'}
            </Text>
          </XStack>
        ) : null}

        {errorMessage ? (
          <YStack
            gap="$1.5"
            padding="$3"
            borderRadius={12}
            backgroundColor={ui.surfaceMuted}
            borderWidth={1}
            borderColor={ui.danger}
          >
            <Text fontSize={13} fontWeight="700" color={ui.danger}>
              Couldn’t generate preview
            </Text>
            <Text fontSize={13} color={ui.text} lineHeight={18}>
              {errorMessage}
            </Text>
          </YStack>
        ) : null}

        {resultUrl ? (
          <YStack gap="$3">
            <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
              Preview
            </Text>
            <YStack
              width="100%"
              aspectRatio={3 / 4}
              borderRadius={16}
              overflow="hidden"
              backgroundColor={ui.surfaceMuted}
              position="relative"
            >
              <Image src={resultUrl} alt="Preview result" width="100%" height="100%" objectFit="cover" />
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
                    text: isTryOn
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
            {busy
              ? 'Generating…'
              : !picked
                ? 'Add a photo to continue'
                : isTryOn
                  ? 'Generate try-on'
                  : `Place on ${placement}`}
          </Button>
        )}
      </YStack>
    </AppBottomSheet>
  )
}
