import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PanResponder,
  Platform,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native'

import { Avatar, Button, Icons, Text, XStack, YStack, useAppToast } from '~/components/ui'
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
  openInstantMeetingSession,
  peekInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'

/** WhatsApp-style floating call bubble (portrait). */
const BUBBLE_W = 118
const BUBBLE_H = 178
const EDGE = 12

type SessionMiniPlayerProps = {
  session: GlobalSessionState
}

type CornerPos = { x: number; y: number }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function snapToNearestCorner(
  x: number,
  y: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): CornerPos {
  const corners: CornerPos[] = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY },
  ]
  let best = corners[0]!
  let bestDist = Number.POSITIVE_INFINITY
  for (const corner of corners) {
    const d = (corner.x - x) ** 2 + (corner.y - y) ** 2
    if (d < bestDist) {
      bestDist = d
      best = corner
    }
  }
  return best
}

/**
 * WhatsApp-call style floating bubble while a meeting/call continues.
 * Drag → snaps to a corner. Tap video → maximize. Mic / End stay on the bubble.
 */
export function SessionMiniPlayer({ session }: SessionMiniPlayerProps) {
  const toast = useAppToast()
  const { safeTop, safeBottom, safeLeft, safeRight, mobileTabBarOffset } = useAppLayout()
  const { width, height } = useWindowDimensions()

  const bounds = useMemo(() => {
    const minX = EDGE + Math.max(0, safeLeft)
    const maxX = Math.max(minX, width - BUBBLE_W - EDGE - Math.max(0, safeRight))
    const minY = EDGE + Math.max(0, safeTop)
    const maxY = Math.max(
      minY,
      height - BUBBLE_H - EDGE - Math.max(mobileTabBarOffset, safeBottom + 8),
    )
    return { minX, maxX, minY, maxY }
  }, [height, mobileTabBarOffset, safeBottom, safeLeft, safeRight, safeTop, width])

  const [pos, setPos] = useState<CornerPos>(() => ({
    x: bounds.maxX,
    y: bounds.minY,
  }))
  const posRef = useRef(pos)
  posRef.current = pos
  const dragOrigin = useRef(pos)

  // Keep bubble on-screen when rotation / chrome insets change.
  useEffect(() => {
    setPos((current) => ({
      x: clamp(current.x, bounds.minX, bounds.maxX),
      y: clamp(current.y, bounds.minY, bounds.maxY),
    }))
  }, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY])

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_: GestureResponderEvent, g: PanResponderGestureState) =>
          Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          dragOrigin.current = posRef.current
        },
        onPanResponderMove: (_e, g) => {
          setPos({
            x: clamp(dragOrigin.current.x + g.dx, bounds.minX, bounds.maxX),
            y: clamp(dragOrigin.current.y + g.dy, bounds.minY, bounds.maxY),
          })
        },
        onPanResponderRelease: (_e, g) => {
          const next = {
            x: clamp(dragOrigin.current.x + g.dx, bounds.minX, bounds.maxX),
            y: clamp(dragOrigin.current.y + g.dy, bounds.minY, bounds.maxY),
          }
          setPos(snapToNearestCorner(next.x, next.y, bounds))
        },
      }),
    [bounds],
  )

  const onMaximize = useCallback(() => {
    const instant = peekInstantMeetingSession()

    // Meetings must expand InstantMeetingHost in place. Never navigate to
    // maximizeHref — that remounts MeetingLiveScreen on Join confirm / Join now.
    if (session.kind === 'meeting') {
      openInstantMeetingSession({
        code: session.code,
        meeting: instant?.meeting ?? null,
        autoJoin: true,
        enteredRoom: true,
        displayName: instant?.displayName ?? null,
      })
      maximizeGlobalSession()
      return
    }

    maximizeGlobalSession()
    if (session.maximizeHref) {
      navigateApp(session.maximizeHref as never)
    }
  }, [session.code, session.kind, session.maximizeHref])

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
          message:
            result.message ||
            sessionPipUnsupportedMessage(caps) ||
            'Keep a camera on, or use Maximize then try again. The floating bubble still keeps the meeting alive.',
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

  const onEnd = useCallback(() => {
    void peekGlobalSessionHandlers().end?.()
    closeInstantMeetingSession()
    clearGlobalSession()
  }, [])

  if (session.presentation !== 'minimized' && session.presentation !== 'pip') {
    return null
  }

  const liveLabel = session.kind === 'call' ? 'Call' : 'Meeting'
  const count = session.participantCount

  return (
    <YStack
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      left={pos.x}
      top={pos.y}
      width={BUBBLE_W}
      height={BUBBLE_H}
      zIndex={120_000}
      elevation={24}
      borderRadius={18}
      overflow="hidden"
      backgroundColor="#1a1016"
      borderWidth={1.5}
      borderColor="rgba(255,255,255,0.22)"
      {...pan.panHandlers}
      style={
        Platform.OS === 'web'
          ? {
              position: 'fixed',
              zIndex: 120_000,
              boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            }
          : undefined
      }
      accessibilityLabel={`${liveLabel} minimized. Tap to return.`}
    >
      {/* Tap target — WhatsApp expands the call from the bubble face. */}
      <YStack
        flex={1}
        width="100%"
        alignItems="center"
        justifyContent="center"
        backgroundColor="#2a1520"
        onPress={onMaximize}
        cursor="pointer"
        accessibilityRole="button"
        accessibilityLabel={`Return to ${liveLabel.toLowerCase()}`}
      >
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          backgroundColor="rgba(216,27,96,0.28)"
          pointerEvents="none"
        />
        <Avatar
          src={session.avatarUrl}
          name={session.title}
          size={56}
          borderWidth={2}
          borderColor="rgba(255,255,255,0.35)"
        />

        <XStack
          position="absolute"
          top={8}
          left={8}
          alignItems="center"
          gap={5}
          paddingHorizontal={7}
          paddingVertical={3}
          borderRadius={999}
          backgroundColor="rgba(0,0,0,0.45)"
        >
          <YStack width={7} height={7} borderRadius={999} backgroundColor="#22c55e" />
          <Text color="#fff" fontSize={10} fontWeight="800">
            {liveLabel}
          </Text>
        </XStack>

        {count != null && count > 0 ? (
          <YStack
            position="absolute"
            top={8}
            right={8}
            minWidth={22}
            height={22}
            paddingHorizontal={6}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor="rgba(216,27,96,0.95)"
          >
            <Text color="#fff" fontSize={11} fontWeight="800">
              {count > 99 ? '99+' : count}
            </Text>
          </YStack>
        ) : null}

        <YStack
          position="absolute"
          left={0}
          right={0}
          bottom={44}
          paddingHorizontal={8}
          alignItems="center"
        >
          <Text color="#fff" fontSize={12} fontWeight="800" numberOfLines={1} textAlign="center">
            {session.title}
          </Text>
        </YStack>
      </YStack>

      <XStack
        height={44}
        alignItems="center"
        justifyContent="space-evenly"
        backgroundColor="rgba(0,0,0,0.55)"
        borderTopWidth={1}
        borderTopColor="rgba(255,255,255,0.08)"
      >
        <Button
          tone="ghost"
          size="$2"
          chromeless
          circular
          width={36}
          height={36}
          padding={0}
          onPress={onToggleMic}
          icon={
            session.media.audioEnabled ? (
              <Icons.Mic size={16} color="#fff" />
            ) : (
              <Icons.MicOff size={16} color="#ff8fa3" />
            )
          }
          accessibilityLabel={session.media.audioEnabled ? 'Mute' : 'Unmute'}
        />
        <Button
          tone="ghost"
          size="$2"
          chromeless
          circular
          width={36}
          height={36}
          padding={0}
          onPress={onMaximize}
          icon={<Icons.Maximize2 size={16} color="#fff" />}
          accessibilityLabel="Maximize"
        />
        {session.pipSupported ? (
          <Button
            tone="ghost"
            size="$2"
            chromeless
            circular
            width={36}
            height={36}
            padding={0}
            onPress={onPip}
            icon={<Icons.Monitor size={16} color="#fff" />}
            accessibilityLabel="Picture in picture"
          />
        ) : null}
        <Button
          tone="ghost"
          size="$2"
          chromeless
          circular
          width={36}
          height={36}
          padding={0}
          backgroundColor="rgba(244,63,104,0.9)"
          onPress={onEnd}
          icon={<Icons.PhoneOff size={15} color="#fff" />}
          accessibilityLabel={session.kind === 'call' ? 'End call' : 'Leave meeting'}
        />
      </XStack>
    </YStack>
  )
}
