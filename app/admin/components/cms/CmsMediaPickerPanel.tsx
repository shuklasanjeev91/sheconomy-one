import { useMemo, useState } from 'react'

import { Button, Icons, Image, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import type { CmsMedia } from '~/lib/cms'
import { useAppUi } from '~/lib/theme/useAppUi'

export type CmsMediaPickerPanelProps = {
  open: boolean
  title: string
  mediaItems: CmsMedia[]
  onClose: () => void
  onSelect: (media: CmsMedia) => void
  onRefresh?: () => void
  uploading?: boolean
}

export function CmsMediaPickerPanel({
  open,
  title,
  mediaItems,
  onClose,
  onSelect,
  onRefresh,
  uploading,
}: CmsMediaPickerPanelProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const images = mediaItems.filter((m) => m.media_type === 'image' && m.is_active !== false)
    if (!needle) return images
    return images.filter(
      (m) =>
        m.file_name.toLowerCase().includes(needle) ||
        (m.alt_text ?? '').toLowerCase().includes(needle) ||
        (m.caption ?? '').toLowerCase().includes(needle),
    )
  }, [mediaItems, search])

  if (!open) return null

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.roseSurface}
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          {title}
        </Text>
        <XStack gap="$2">
          {onRefresh ? (
            <Button size="$2" tone="outline" icon={Icons.RefreshCw} onPress={onRefresh} />
          ) : null}
          <Button size="$2" tone="outline" onPress={onClose}>
            Close
          </Button>
        </XStack>
      </XStack>

      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Search media by name or alt text…"
      />

      {uploading ? (
        <XStack gap="$2" alignItems="center">
          <Spinner size="small" />
          <Text fontSize={13} color={ui.textMuted}>
            Uploading…
          </Text>
        </XStack>
      ) : null}

      {filtered.length === 0 ? (
        <YStack minHeight={120} alignItems="center" justifyContent="center" gap="$1">
          <Text fontWeight="600" color={ui.text}>
            No images found
          </Text>
          <Text fontSize={13} color={ui.textMuted}>
            Upload media on the Media page or adjust your search.
          </Text>
        </YStack>
      ) : (
        <XStack gap="$2" flexWrap="wrap">
          {filtered.map((item) => (
            <YStack
              key={item.id}
              width={isDesktop ? 140 : '30%'}
              minWidth={100}
              gap="$1"
              padding="$2"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
              cursor="pointer"
              hoverStyle={{ borderColor: ui.brand, opacity: 0.95 }}
              onPress={() => onSelect(item)}
            >
              {item.public_url ? (
                <Image
                  source={{ uri: item.public_url }}
                  width="100%"
                  height={90}
                  borderRadius={8}
                  resizeMode="cover"
                  alt={item.alt_text ?? item.file_name}
                />
              ) : (
                <YStack
                  height={90}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={ui.surfaceMuted}
                  borderRadius={8}
                >
                  <Icons.Image size={24} color={ui.textMuted} />
                </YStack>
              )}
              <Text fontSize={11} color={ui.textSecondary} numberOfLines={2}>
                {item.file_name}
              </Text>
            </YStack>
          ))}
        </XStack>
      )}
    </YStack>
  )
}
