import { Platform } from 'react-native'

import type { CallType } from '~/chat/lib/calls'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'

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
const ACCEPT = '#25d366'
const DECLINE = '#f2385a'

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

export function CallOverlay({
  name,
  avatarUrl,
  callType,
  variant,
  statusText,
  onAccept,
  onDecline,
}: CallOverlayProps) {
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
