import { createElement, useEffect, useId, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { YStack } from '~/components/ui'

type YoutubeWatchPlayerProps = {
  youtubeId: string
  title: string
  autoPlay?: boolean
  onEnded?: () => void
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        config: {
          videoId: string
          width?: string | number
          height?: string | number
          playerVars?: Record<string, string | number>
          events?: {
            onStateChange?: (event: { data: number }) => void
          }
        },
      ) => { destroy?: () => void }
      PlayerState?: { ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

const YT_ENDED = 0

function loadYoutubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.YT?.Player) return Promise.resolve()

  return new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }

    if (document.querySelector('script[data-yt-iframe-api="1"]')) return

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.dataset.ytIframeApi = '1'
    document.body.appendChild(script)
  })
}

function WebYoutubeWatchPlayer({
  youtubeId,
  title,
  autoPlay = true,
  onEnded,
}: YoutubeWatchPlayerProps) {
  const reactId = useId().replace(/:/g, '')
  const containerId = `yt-watch-${reactId}`
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  useEffect(() => {
    let player: { destroy?: () => void } | null = null
    let cancelled = false

    void loadYoutubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return
      player = new window.YT.Player(containerId, {
        videoId: youtubeId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onStateChange: (event) => {
            if (event.data === (window.YT?.PlayerState?.ENDED ?? YT_ENDED)) {
              onEndedRef.current?.()
            }
          },
        },
      })
    })

    return () => {
      cancelled = true
      try {
        player?.destroy?.()
      } catch {
        // ignore
      }
    }
  }, [autoPlay, containerId, youtubeId])

  return createElement('div', {
    style: {
      width: '100%',
      aspectRatio: '16 / 9',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#000',
      position: 'relative',
    },
    'aria-label': title,
    children: createElement('div', {
      id: containerId,
      style: { width: '100%', height: '100%' },
    }),
  })
}

function NativeYoutubeWatchPlayer({
  youtubeId,
  title,
  autoPlay = true,
  onEnded,
}: YoutubeWatchPlayerProps) {
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const [WebView, setWebView] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    void import('react-native-webview').then((module) => setWebView(() => module.WebView))
  }, [])

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <style>
      html, body, #player { margin: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="player"></div>
    <script>
      var endedSent = false;
      function notifyEnded() {
        if (endedSent) return;
        endedSent = true;
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage('ended');
        }
      }
      var tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      function onYouTubeIframeAPIReady() {
        new YT.Player('player', {
          videoId: ${JSON.stringify(youtubeId)},
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: ${autoPlay ? 1 : 0},
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            origin: 'https://com.sheconomy.ecommerce'
          },
          events: {
            onStateChange: function (event) {
              if (event.data === 0) notifyEnded();
            }
          }
        });
      }
    </script>
  </body>
</html>`

  if (!WebView) {
    return <YStack width="100%" aspectRatio={16 / 9} borderRadius={12} backgroundColor="#000" />
  }

  return (
    <YStack width="100%" aspectRatio={16 / 9} borderRadius={12} overflow="hidden" backgroundColor="#000">
      <WebView
        source={{ html, baseUrl: 'https://com.sheconomy.ecommerce' }}
        style={{ flex: 1, backgroundColor: '#000' }}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        userAgent="Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36"
        onMessage={(event: { nativeEvent: { data: string } }) => {
          if (event.nativeEvent.data === 'ended') onEndedRef.current?.()
        }}
        accessibilityLabel={title}
      />
    </YStack>
  )
}

export function YoutubeWatchPlayer(props: YoutubeWatchPlayerProps) {
  if (Platform.OS === 'web') {
    return <WebYoutubeWatchPlayer {...props} />
  }
  return <NativeYoutubeWatchPlayer {...props} />
}
