import { useMemo, useState } from 'react'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import {
  isVisualPreviewEnabled,
  resolveVisualPreviewMode,
  suggestVisualPreviewPlacement,
  type VisualPreviewMode,
  type VisualPreviewPlacement,
} from '~/lib/listing/visual-preview'
import { useAppUi } from '~/lib/theme/useAppUi'

import { VisualPreviewSheet } from '~/commerce/components/visual-preview/VisualPreviewSheet'

type ListingVisualPreviewButtonsProps = {
  listingId: string
  listingTitle: string
  category?: string | null
  tags?: string[] | null
  listingMetadata?: Record<string, unknown> | null
  hasPrimaryImage: boolean
  listingImageUrl?: string | null
  listingShareUrl?: string | null
}

export function ListingVisualPreviewButtons({
  listingId,
  listingTitle,
  category,
  tags,
  listingMetadata,
  hasPrimaryImage,
  listingImageUrl,
  listingShareUrl,
}: ListingVisualPreviewButtonsProps) {
  const ui = useAppUi()
  const [openMode, setOpenMode] = useState<VisualPreviewMode | null>(null)

  const listingLike = useMemo(
    () => ({
      category,
      title: listingTitle,
      tags,
      listing_metadata: listingMetadata,
      hasPrimaryImage,
    }),
    [category, listingTitle, tags, listingMetadata, hasPrimaryImage],
  )

  const mode = useMemo(() => {
    if (!isVisualPreviewEnabled()) return null
    return resolveVisualPreviewMode(listingLike)
  }, [listingLike])

  const defaultPlacement: VisualPreviewPlacement = useMemo(
    () => suggestVisualPreviewPlacement(listingLike),
    [listingLike],
  )

  if (!mode) return null

  const isTryOn = mode === 'try_on'
  const label = isTryOn ? 'Try on' : 'View in your room'
  const subtitle = isTryOn
    ? 'See how it looks on you'
    : 'Preview on your wall, floor, or table'
  const icon = isTryOn ? (
    <Icons.Sparkles size={16} color={ui.brand} />
  ) : (
    <Icons.Home size={16} color={ui.brand} />
  )

  return (
    <>
      <YStack gap="$1.5" width="100%">
        <Button
          size="$3"
          tone="outline"
          icon={icon}
          onPress={() => setOpenMode(mode)}
          borderColor={ui.brand}
          alignSelf="flex-start"
        >
          {label}
        </Button>
        <Text fontSize={12} color={ui.textMuted}>
          {subtitle}
        </Text>
      </YStack>

      {openMode ? (
        <VisualPreviewSheet
          open
          onOpenChange={(next) => {
            if (!next) setOpenMode(null)
          }}
          mode={openMode}
          listingId={listingId}
          listingTitle={listingTitle}
          listingCategory={category}
          listingImageUrl={listingImageUrl}
          listingShareUrl={listingShareUrl}
          defaultPlacement={defaultPlacement}
        />
      ) : null}
    </>
  )
}
