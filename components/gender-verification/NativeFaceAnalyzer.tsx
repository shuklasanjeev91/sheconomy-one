import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Platform } from 'react-native'

import type { GenderEstimate } from '~/lib/gender-verification/constants'
import { getNativeAnalyzerHtml } from '~/lib/gender-verification/native-analyzer-html'

export type NativeFaceFrame = {
  box: { xMin: number; xMax: number; yMin: number; yMax: number }
  leftEar: number
  rightEar: number
}

export type NativeFrameAnalysis = {
  face: NativeFaceFrame | null
  gender: GenderEstimate | null
  width: number
  height: number
  eyesClosed: boolean
  liveScore: number
  realScore: number
}

/** `both` returns gender alongside the anti-spoof scores from a single pass. */
export type NativeAnalyzeMode = 'liveness' | 'gender' | 'both'

export type NativeFaceAnalyzerHandle = {
  analyze: (
    base64: string,
    width: number,
    height: number,
    mode: NativeAnalyzeMode,
  ) => Promise<NativeFrameAnalysis>
  isReady: boolean
}

type PendingRequest = {
  resolve: (value: NativeFrameAnalysis) => void
  reject: (reason: Error) => void
}

const ANALYZE_TIMEOUT_MS = 12_000

type NativeFaceAnalyzerProps = {
  onReady?: () => void
  onError?: (message: string) => void
}

export const NativeFaceAnalyzer = forwardRef<NativeFaceAnalyzerHandle, NativeFaceAnalyzerProps>(
  function NativeFaceAnalyzer({ onReady, onError }, ref) {
    const webViewRef = useRef<import('react-native-webview').WebView | null>(null)
    const [WebViewComponent, setWebViewComponent] = useState<React.ComponentType<any> | null>(null)
    const [ready, setReady] = useState(false)
    const pendingRef = useRef(new Map<string, PendingRequest>())
    const seqRef = useRef(0)

    useEffect(() => {
      if (Platform.OS === 'web') return
      void import('react-native-webview').then((module) => setWebViewComponent(() => module.WebView))
    }, [])

    const analyze = useCallback(
      (base64: string, width: number, height: number, mode: NativeAnalyzeMode) => {
        if (!ready || !webViewRef.current) {
          return Promise.reject(new Error('Face analyzer is not ready yet.'))
        }

        const id = String(++seqRef.current)

        return new Promise<NativeFrameAnalysis>((resolve, reject) => {
          const timeout = setTimeout(() => {
            pendingRef.current.delete(id)
            reject(new Error('Face analysis timed out.'))
          }, ANALYZE_TIMEOUT_MS)

          pendingRef.current.set(id, {
            resolve: (value) => {
              clearTimeout(timeout)
              resolve(value)
            },
            reject: (reason) => {
              clearTimeout(timeout)
              reject(reason)
            },
          })

          webViewRef.current?.postMessage(
            JSON.stringify({
              type: 'analyze',
              id,
              base64,
              width,
              height,
              mode,
            }),
          )
        })
      },
      [ready],
    )

    useImperativeHandle(
      ref,
      () => ({
        analyze,
        isReady: ready,
      }),
      [analyze, ready],
    )

    const onMessage = useCallback(
      (event: { nativeEvent: { data: string } }) => {
        try {
          const message = JSON.parse(event.nativeEvent.data) as {
            type: string
            id?: string
            face?: NativeFaceFrame | null
            gender?: GenderEstimate | null
            width?: number
            height?: number
            eyesClosed?: boolean
            liveScore?: number
            realScore?: number
            message?: string
          }

          if (message.type === 'ready') {
            setReady(true)
            onReady?.()
            return
          }

          if (message.type === 'error') {
            const error = new Error(message.message ?? 'Face analysis failed.')
            if (message.id) {
              const pending = pendingRef.current.get(message.id)
              pendingRef.current.delete(message.id)
              pending?.reject(error)
            } else {
              setReady(false)
              for (const pending of pendingRef.current.values()) pending.reject(error)
              pendingRef.current.clear()
              onError?.(error.message)
            }
            return
          }

          if (message.type === 'result' && message.id) {
            const pending = pendingRef.current.get(message.id)
            pendingRef.current.delete(message.id)
            pending?.resolve({
              face: message.face ?? null,
              gender: message.gender ?? null,
              width: message.width ?? 0,
              height: message.height ?? 0,
              eyesClosed: !!message.eyesClosed,
              liveScore: Number(message.liveScore ?? 0),
              realScore: Number(message.realScore ?? 0),
            })
          }
        } catch {
          // Ignore malformed analyzer messages.
        }
      },
      [onError, onReady],
    )

    if (Platform.OS === 'web' || !WebViewComponent) return null

    const WebView = WebViewComponent

    return (
      <WebView
        ref={webViewRef}
        source={{ html: getNativeAnalyzerHtml() }}
        onMessage={onMessage}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mixedContentMode="always"
        allowFileAccess
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    )
  },
)
