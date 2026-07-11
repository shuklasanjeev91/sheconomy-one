import { useEffect, useState } from 'react'
import { Linking } from 'react-native'

import { fetchLinkPreview, type LinkPreview } from '~/chat/lib/link-preview'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { Image, Text, YStack } from '~/components/ui'

type LinkPreviewCardProps = {
  url: string
  isOwn: boolean
}

/** Rich Open Graph preview card rendered inside a text bubble. */
export function LinkPreviewCard({ url, isOwn }: LinkPreviewCardProps) {
  const chat = useChatTheme()
  const [preview, setPreview] = useState<LinkPreview | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchLinkPreview(url).then((result) => {
      if (!cancelled) setPreview(result)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  if (!preview) return null

  const accent = isOwn ? chat.bubbleMetaOut : chat.brand
  const titleColor = isOwn ? chat.bubbleOutText : chat.bubbleInText
  const descColor = isOwn ? chat.bubbleMetaOut : chat.textSecondary

  return (
    <YStack
      onPress={() => {
        Linking.openURL(preview.url).catch(() => {})
      }}
      cursor="pointer"
      marginBottom={4}
      borderRadius={8}
      overflow="hidden"
      backgroundColor={isOwn ? 'rgba(0,0,0,0.08)' : chat.quoteBg}
      borderLeftWidth={3}
      borderLeftColor={accent}
      width={248}
      pressStyle={{ opacity: 0.85 }}
    >
      {preview.image ? (
        <Image src={preview.image} width={248} height={124} objectFit="cover" alt="Link preview" />
      ) : null}
      <YStack paddingVertical={7} paddingHorizontal={9} gap={2}>
        {preview.siteName ? (
          <Text fontSize={11} fontWeight="600" color={accent} numberOfLines={1}>
            {preview.siteName}
          </Text>
        ) : null}
        {preview.title ? (
          <Text fontSize={13.5} fontWeight="700" color={titleColor} numberOfLines={2}>
            {preview.title}
          </Text>
        ) : null}
        {preview.description ? (
          <Text fontSize={12} color={descColor} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
}
