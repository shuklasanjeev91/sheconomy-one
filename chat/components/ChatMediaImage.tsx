import { useEffect, useState } from 'react'

import { getChatMediaUrl } from '~/chat/lib/chats'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { Icons, Image, Spinner, YStack } from '~/components/ui'

type ChatMediaImageProps = {
  /** Storage path in `chat-files`, an absolute URL, or a local preview URI. */
  path: string
  width?: number
  height?: number
}

const LOCAL_URI = /^(https?:|blob:|file:|data:|content:)/i

/** Resolves a chat image (private bucket → signed URL) and renders it with a loading state. */
export function ChatMediaImage({ path, width = 232, height = 232 }: ChatMediaImageProps) {
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
      backgroundColor={chat.threadPattern}
      alignItems="center"
      justifyContent="center"
    >
      {url ? (
        <Image src={url} width={width} height={height} objectFit="cover" alt="Shared photo" />
      ) : failed ? (
        <Icons.ImageOff size={26} color={chat.textMuted} />
      ) : (
        <Spinner size="small" color={chat.brand} />
      )}
    </YStack>
  )
}
