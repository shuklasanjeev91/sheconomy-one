import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { getChatMediaUrl } from '~/chat/lib/chats'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { Icons, Spinner, Text, YStack } from '~/components/ui'

type ChatMediaVideoProps = {
  path: string
  width?: number
  height?: number
}

const LOCAL_URI = /^(https?:|blob:|file:|data:|content:)/i

/** Resolves a chat video (private bucket → signed URL) and renders a playable preview. */
export function ChatMediaVideo({ path, width = 260, height = 200 }: ChatMediaVideoProps) {
  const chat = useChatTheme()
  const [url, setUrl] = useState<string | null>(LOCAL_URI.test(path) ? path : null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (LOCAL_URI.test(path)) {
      setUrl(path)
      return
    }
    setUrl(null)
    setFailed(false)
    getChatMediaUrl(path).then((resolved) => {
      if (cancelled) return
      if (resolved) setUrl(resolved)
      else setFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  return (
    <YStack
      width={width}
      height={height}
      borderRadius={14}
      overflow="hidden"
      backgroundColor="#000"
      alignItems="center"
      justifyContent="center"
    >
      {url && Platform.OS === 'web' ? (
        <video
          src={url}
          controls
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        />
      ) : url ? (
        <YStack alignItems="center" gap={8} padding="$3">
          <Icons.Video size={28} color="white" />
          <Text fontSize={12} color="white" textAlign="center">
            Video attached — open to play
          </Text>
        </YStack>
      ) : failed ? (
        <Icons.VideoOff size={26} color={chat.textMuted} />
      ) : (
        <Spinner size="small" color={chat.brand} />
      )}
    </YStack>
  )
}
