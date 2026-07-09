import { useEffect, useState } from 'react'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { searchGifs, type GifResult } from '~/community/lib/giphy'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Icons, Image, Input, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type GifPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (gifUrl: string) => void
}

export function GifPicker({ open, onOpenChange, onSelect }: GifPickerProps) {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    let active = true
    setIsLoading(true)
    const timer = setTimeout(() => {
      searchGifs(query).then((results) => {
        if (!active) return
        setGifs(results)
        setIsLoading(false)
      })
    }, query ? 300 : 0)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [open, query])

  return (
    <CommunityAdaptiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Choose a GIF"
      maxWidth={560}
    >
      <YStack gap="$3">
        <XStack
          gap="$2"
          alignItems="center"
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius={8}
          borderWidth={1}
          borderColor={communityUi.border}
          backgroundColor={ui.surfaceMuted}
        >
          <Icons.Search size={18} color={ui.textMuted} />
          <Input
            flex={1}
            value={query}
            onChangeText={setQuery}
            placeholder="Search GIFs"
            borderWidth={0}
            backgroundColor="transparent"
            paddingHorizontal={0}
          />
        </XStack>

        {isLoading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner />
          </YStack>
        ) : (
          <XStack flexWrap="wrap" gap={8}>
            {gifs.map((gif) => (
              <YStack
                key={gif.id}
                width="31%"
                minWidth={100}
                aspectRatio={1}
                borderRadius={8}
                overflow="hidden"
                cursor="pointer"
                borderWidth={1}
                borderColor={communityUi.borderLight}
                hoverStyle={{ borderColor: communityUi.brand, opacity: 0.9 }}
                onPress={() => {
                  onSelect(gif.url)
                  onOpenChange(false)
                  setQuery('')
                }}
              >
                <Image src={gif.previewUrl} width="100%" height="100%" objectFit="cover" alt={gif.title} />
              </YStack>
            ))}
          </XStack>
        )}

        <Text fontSize={11} color={ui.textMuted} textAlign="center">
          Powered by GIPHY
        </Text>
      </YStack>
    </CommunityAdaptiveSheet>
  )
}