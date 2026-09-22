import { Pressable } from 'react-native'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingInviteOthersCardProps = {
  visible: boolean
  onInvite: () => void
  onDismiss?: () => void
}

/**
 * Zoom invite tip — floating white pill on iPad/large, rose card on phone.
 */
export function MeetingInviteOthersCard({
  visible,
  onInvite,
  onDismiss,
}: MeetingInviteOthersCardProps) {
  const { ui } = useCoWorkTheme()
  const { isTablet, isDesktop } = useAppLayout()
  const pill = isTablet || isDesktop
  if (!visible) return null

  if (pill) {
    return (
      <YStack alignSelf="center" zIndex={40} pointerEvents="box-none" marginBottom="$1">
        <Pressable
          onPress={onInvite}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.08)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          }}
        >
          <Icons.Users size={15} color={ui.brand} />
          <Text color="#111" fontSize={13} fontWeight="700">
            Invite your contacts to join this meeting
          </Text>
        </Pressable>
      </YStack>
    )
  }

  return (
    <YStack
      alignSelf="center"
      maxWidth={340}
      width="92%"
      zIndex={40}
      pointerEvents="box-none"
      marginBottom="$2"
    >
      <XStack
        alignItems="flex-start"
        gap="$3"
        paddingHorizontal="$3.5"
        paddingVertical="$3"
        borderRadius={14}
        backgroundColor="rgba(32, 17, 27, 0.94)"
        borderWidth={1}
        borderColor={ui.borderSoft}
      >
        <YStack
          width={34}
          height={34}
          borderRadius={10}
          alignItems="center"
          justifyContent="center"
          backgroundColor={ui.brandMuted}
          borderWidth={1}
          borderColor={ui.borderAccent}
        >
          <Icons.Users size={16} color={ui.brandLight} />
        </YStack>
        <YStack flex={1} gap={4}>
          <Text color="#fff" fontSize={14} fontWeight="800">
            Invite others
          </Text>
          <Pressable onPress={onInvite} accessibilityRole="button">
            <Text color={ui.brandLight} fontSize={13} fontWeight="700" lineHeight={18}>
              Invite your contacts to join this meeting.
            </Text>
          </Pressable>
        </YStack>
        {onDismiss ? (
          <Pressable
            onPress={onDismiss}
            accessibilityLabel="Dismiss invite tip"
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Icons.X size={14} color={ui.textMuted} />
          </Pressable>
        ) : null}
      </XStack>
    </YStack>
  )
}
