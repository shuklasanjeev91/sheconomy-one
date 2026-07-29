import { useEffect } from 'react'
import { Platform, Vibration } from 'react-native'

import type { CallType } from '~/chat/lib/calls'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import { brandColors } from '~/config/brand-colors'

type CallOverlayProps = {
  name: string
  avatarUrl: string | null
  callType: CallType
  variant: 'incoming' | 'outgoing'
  statusText: string
  onAccept?: () => void
  /** Decline (incoming) or cancel/hang-up (outgoing). */
  onDecline: () => void
}

const OVERLAY_BG = '#0f0a0d'
const SUBTLE = '#c9b6c1'
const ACCEPT = brandColors.primary
const DECLINE = '#f2385a'

/** Native vibrate pattern: wait, buzz, pause — loops while ringing. */
const RING_VIBRATE_PATTERN = [0, 700, 400, 700, 1200]

function RoundButton({
  color,
  onPress,
  label,
  children,
}: {
  color: string
  onPress: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <YStack
      onPress={onPress}
      cursor="pointer"
      width={66}
      height={66}
      borderRadius={999}
      alignItems="center"
      justifyContent="center"
      backgroundColor={color}
      pressStyle={{ scale: 0.9 }}
      hoverStyle={{ opacity: 0.9 }}
      animation="quick"
      shadowColor="#000"
      shadowOpacity={0.35}
      shadowRadius={12}
      shadowOffset={{ width: 0, height: 6 }}
      aria-label={label}
    >
      {children}
    </YStack>
  )
}

function useIncomingRing(active: boolean) {
  useEffect(() => {
    if (!active) return

    let webAudio: { ctx: AudioContext; stop: () => void } | null = null

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (AudioCtx) {
          const ctx = new AudioCtx()
          const gain = ctx.createGain()
          gain.gain.value = 0.08
          gain.connect(ctx.destination)

          let stopped = false
          const beep = () => {
            if (stopped) return
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.value = 880
            osc.connect(gain)
            osc.start()
            osc.stop(ctx.currentTime + 0.35)
            window.setTimeout(beep, 900)
          }
          void ctx.resume().then(beep)
          webAudio = {
            ctx,
            stop: () => {
              stopped = true
              void ctx.close()
            },
          }
        }
      } catch {
        // ignore audio failures
      }
    } else {
      try {
        Vibration.vibrate(RING_VIBRATE_PATTERN, true)
      } catch {
        // ignore
      }
    }

    return () => {
      webAudio?.stop()
      try {
        Vibration.cancel()
      } catch {
        // ignore
      }
    }
  }, [active])
}

export function CallOverlay({
  name,
  avatarUrl,
  callType,
  variant,
  statusText,
  onAccept,
  onDecline,
}: CallOverlayProps) {
  useIncomingRing(variant === 'incoming')

  return (
    <YStack
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={200_000}
      backgroundColor={OVERLAY_BG}
      alignItems="center"
      justifyContent="space-between"
      paddingVertical={72}
      paddingHorizontal={24}
    >
      <YStack alignItems="center" gap={18} marginTop={40}>
        <XStack alignItems="center" gap={8}>
          {callType === 'video' ? (
            <Icons.Video size={16} color={SUBTLE} />
          ) : (
            <Icons.Phone size={16} color={SUBTLE} />
          )}
          <Text fontSize={14} color={SUBTLE} letterSpacing={0.3}>
            {callType === 'video' ? 'Video call' : 'Voice call'}
          </Text>
        </XStack>

        <Avatar size="$10" name={name} src={avatarUrl ?? undefined} />

        <YStack alignItems="center" gap={6}>
          <Text fontSize={26} fontWeight="800" color="#ffffff" textAlign="center" numberOfLines={2}>
            {name}
          </Text>
          <Text fontSize={15} color={SUBTLE}>
            {statusText}
          </Text>
        </YStack>
      </YStack>

      <XStack width="100%" maxWidth={320} justifyContent={variant === 'incoming' ? 'space-between' : 'center'}>
        {variant === 'incoming' ? (
          <>
            <YStack alignItems="center" gap={10}>
              <RoundButton color={DECLINE} onPress={onDecline} label="Decline">
                <Icons.PhoneOff size={28} color="#ffffff" />
              </RoundButton>
              <Text fontSize={13} color={SUBTLE}>
                Decline
              </Text>
            </YStack>
            <YStack alignItems="center" gap={10}>
              <RoundButton color={ACCEPT} onPress={() => onAccept?.()} label="Accept">
                {callType === 'video' ? (
                  <Icons.Video size={28} color="#ffffff" />
                ) : (
                  <Icons.Phone size={28} color="#ffffff" />
                )}
              </RoundButton>
              <Text fontSize={13} color={SUBTLE}>
                Accept
              </Text>
            </YStack>
          </>
        ) : (
          <YStack alignItems="center" gap={10}>
            <RoundButton color={DECLINE} onPress={onDecline} label="Cancel call">
              <Icons.PhoneOff size={28} color="#ffffff" />
            </RoundButton>
            <Text fontSize={13} color={SUBTLE}>
              Cancel
            </Text>
          </YStack>
        )}
      </XStack>
    </YStack>
  )
}
