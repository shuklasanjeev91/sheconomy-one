import { useCallback, useMemo, useRef, useState } from 'react'
import {
  PanResponder,
  Platform,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native'

import { Button, Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
import {
  maximizeGlobalSession,
  minimizeGlobalSession,
  enterGlobalSessionPip,
  clearGlobalSession,
  type GlobalSessionState,
  peekGlobalSessionHandlers,
} from '~/lib/session/global-session'
import {
  detectSessionPipCapabilities,
  requestSessionPictureInPicture,
  sessionPipUnsupportedMessage,
} from '~/lib/session/picture-in-picture'
import { navigateApp } from '~/lib/platform/navigate'
import { useAppLayout } from '~/hooks/useAppLayout'
import {
  closeInstantMeetingSession,
  peekInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'

const MINI_WIDTH = 280
const MINI_HEIGHT = 152

type SessionMiniPlayerProps = {
  session: GlobalSessionState
}

/**
 * Corner-docked mini-player while a meeting/call continues and the user browses
 * any Sheconomy tab. Maximize restores fullscreen; PiP uses OS APIs when supported.
 */
export function SessionMiniPlayer({ session }: SessionMiniPlayerProps) {
  const toast = useAppToast()
  const { safeTop, safeBottom, safeRight } = useAppLayout()
  const { width, height } = useWindowDimensions()
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const startRef = useRef({ x: 0, y: 0 })

  const defaultPos = useMemo(() => {
    const x = Math.max(12, width - MINI_WIDTH - Math.max(12, safeRight) - 8)
    const y = Math.max(safeTop + 12, height - MINI_HEIGHT - safeBottom - 88)
    return { x, y }
  }, [height, safeBottom, safeRight, safeTop, width])

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_: GestureResponderEvent, g: PanResponderGestureState) =>
          Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        onPanResponderGrant: () => {
          startRef.current = offset
        },
        onPanResponderMove: (_e, g) => {
          setOffset({
            x: startRef.current.x + g.dx,
            y: startRef.current.y + g.dy,
          })
        },
      }),
    [offset],
  )

  const left = defaultPos.x + offset.x
  const top = defaultPos.y + offset.y

  const onMaximize = useCallback(() => {
    maximizeGlobalSession()
    const instant = peekInstantMeetingSession()
    if (instant && instant.code === session.code) {
      // InstantMeetingHost expands in place — no route hop.
      return
    }
    if (session.maximizeHref) {
      navigateApp(session.maximizeHref as never)
    }
  }, [session.code, session.maximizeHref])

  const onPip = useCallback(() => {
    const caps = detectSessionPipCapabilities()
    if (!caps.supported && Platform.OS !== 'web') {
      toast.show('Picture-in-Picture unavailable', {
        tone: 'info',
        message: sessionPipUnsupportedMessage(caps),
      })
      return
    }
    void (async () => {
      const result = await requestSessionPictureInPicture(
        '.sheconomy-meeting-overlay video, video',
      )
      if (!result.ok) {
        toast.show('Picture-in-Picture unavailable', {
          tone: 'info',
          message: result.message || sessionPipUnsupportedMessage(caps),
        })
        if (Platform.OS === 'web') minimizeGlobalSession()
        return
      }
      enterGlobalSessionPip()
    })()
  }, [toast])

  const onToggleMic = useCallback(() => {
    void peekGlobalSessionHandlers().toggleMic?.()
  }, [])

  const onToggleCamera = useCallback(() => {
    void peekGlobalSessionHandlers().toggleCamera?.()
  }, [])

  const onEnd = useCallback(() => {
    void peekGlobalSessionHandlers().end?.()
    closeInstantMeetingSession()
    clearGlobalSession()
  }, [])

  if (session.presentation !== 'minimized' && session.presentation !== 'pip') {
    return null
  }

  // While OS PiP is active, keep a thin bar so the user can return.
  const compactPip = session.presentation === 'pip'

  return (
    <YStack
      position="absolute"
      left={left}
      top={top}
      width={compactPip ? 200 : MINI_WIDTH}
      zIndex={90000}
      elevation={12}
      borderRadius={16}
      overflow="hidden"
      backgroundColor="#1a1016"
      borderWidth={1}
      borderColor="rgba(255,255,255,0.14)"
      {...pan.panHandlers}
      accessibilityLabel={`${session.kind === 'call' ? 'Call' : 'Meeting'} mini player`}
    >
      <XStack
        paddingHorizontal="$3"
        paddingVertical="$2"
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        backgroundColor="rgba(216,27,96,0.18)"
      >
        <YStack flex={1} minWidth={0} gap={2}>
          <Text color="#fff" fontSize={13} fontWeight="800" numberOfLines={1}>
            {session.title}
          </Text>
          {session.subtitle ? (
            <Text color="rgba(255,255,255,0.65)" fontSize={11} numberOfLines={1}>
              {session.subtitle}
            </Text>
          ) : (
            <Text color="rgba(255,255,255,0.55)" fontSize={11} numberOfLines={1}>
              {session.kind === 'call' ? 'Call continues' : 'Meeting continues while you browse'}
            </Text>
          )}
        </YStack>
        <Button
          tone="ghost"
          size="$2"
          borderRadius={999}
          onPress={onMaximize}
          icon={<Icons.Maximize2 size={16} color="#fff" />}
          accessibilityLabel="Maximize"
        />
      </XStack>

      {!compactPip ? (
        <XStack padding="$2" gap="$1.5" flexWrap="wrap" justifyContent="center">
          <Button
            tone="outline"
            size="$2"
            borderRadius={999}
            onPress={onToggleMic}
            icon={
              session.media.audioEnabled ? (
                <Icons.Mic size={14} color="#fff" />
              ) : (
                <Icons.MicOff size={14} color="#ff8fa3" />
              )
            }
          >
            {session.media.audioEnabled ? 'Mute' : 'Unmute'}
          </Button>
          {session.kind === 'meeting' || session.media.videoEnabled !== undefined ? (
            <Button
              tone="outline"
              size="$2"
              borderRadius={999}
              onPress={onToggleCamera}
              icon={
                session.media.videoEnabled ? (
                  <Icons.Video size={14} color="#fff" />
                ) : (
                  <Icons.VideoOff size={14} color="#ff8fa3" />
                )
              }
            >
              Cam
            </Button>
          ) : null}
          <Button
            tone="outline"
            size="$2"
            borderRadius={999}
            onPress={onPip}
            icon={<Icons.Monitor size={14} color="#fff" />}
          >
            PiP
          </Button>
          <Button
            tone="outline"
            size="$2"
            borderRadius={999}
            borderColor="rgba(244,63,104,0.45)"
            color="#ff8fa3"
            onPress={onEnd}
            icon={<Icons.PhoneOff size={14} color="#ff8fa3" />}
          >
            End
          </Button>
        </XStack>
      ) : (
        <XStack padding="$2" justifyContent="center">
          <Button tone="primary" size="$2" borderRadius={999} onPress={onMaximize}>
            Return to {session.kind === 'call' ? 'call' : 'meeting'}
          </Button>
        </XStack>
      )}
    </YStack>
  )
}
