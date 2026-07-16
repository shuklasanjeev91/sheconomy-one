import { useEffect, useState } from 'react'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { searchGifs, type GifResult } from '~/community/lib/giphy'
import { useCommunityUi } from '~/community/lib/community-theme'
import { ScreenSearchField } from '~/components/search'
import { Image, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useScreenSearch } from '~/hooks/useScreenSearch'
import { useAppUi } from '~/lib/theme/useAppUi'

type GifPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (gifUrl: string) => void
}

export function GifPicker({ open, onOpenChange, onSelect }: GifPickerProps) {
  const communityUi = useCommunityUi()
  const ui = useAppUi()
  const { input: query, setInput: setQuery, debounced: debouncedQuery } = useScreenSearch()
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    let active = true
    setIsLoading(true)
    void searchGifs(debouncedQuery).then((results) => {
      if (!active) return
      setGifs(results)
      setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [debouncedQuery, open])

  return (
    <CommunityAdaptiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Choose a GIF"
      maxWidth={560}
    >
      <YStack gap="$3">
        <ScreenSearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search GIFs"
        />

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