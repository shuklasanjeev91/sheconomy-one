import { useMemo, useState } from 'react'

import { Button, Icons, XStack } from '~/components/ui'
import {
  isVisualPreviewEnabled,
  resolveVisualPreviewMode,
  type VisualPreviewMode,
} from '~/lib/listing/visual-preview'
import { useAppUi } from '~/lib/theme/useAppUi'

import { VisualPreviewSheet } from './VisualPreviewSheet'

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

  const mode = useMemo(() => {
    if (!isVisualPreviewEnabled()) return null
    return resolveVisualPreviewMode({
      category,
      tags,
      listing_metadata: listingMetadata,
      hasPrimaryImage,
    })
  }, [category, tags, listingMetadata, hasPrimaryImage])

  if (!mode) return null

  const label = mode === 'try_on' ? 'Try on' : 'View in your room'
  const icon =
    mode === 'try_on' ? (
      <Icons.Sparkles size={16} color={ui.brand} />
    ) : (
      <Icons.Home size={16} color={ui.brand} />
    )

  return (
    <>
      <XStack gap="$2" flexWrap="wrap">
        <Button
          size="$3"
          tone="outline"
          icon={icon}
          onPress={() => setOpenMode(mode)}
          borderColor={ui.brand}
        >
          {label}
        </Button>
      </XStack>

      {openMode ? (
        <VisualPreviewSheet
          open
          onOpenChange={(next) => {
            if (!next) setOpenMode(null)
          }}
          mode={openMode}
          listingId={listingId}
          listingTitle={listingTitle}
          listingImageUrl={listingImageUrl}
          listingShareUrl={listingShareUrl}
        />
      ) : null}
    </>
  )
}
