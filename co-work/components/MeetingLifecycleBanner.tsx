import { Text, YStack } from '~/components/ui'

type MeetingLifecycleBannerProps = {
  notice: string | null
  /** Slightly lower under native status / web header layout. */
  topOffset?: number
}

/** Non-blocking status chip for background / OS media / reconnect states. */
export function MeetingLifecycleBanner({
  notice,
  topOffset = 88,
}: MeetingLifecycleBannerProps) {
  if (!notice) return null

  return (
    <YStack
      position="absolute"
      top={topOffset}
      alignSelf="center"
      zIndex={45}
      maxWidth="92%"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius={999}
      backgroundColor="rgba(20,15,18,0.92)"
      borderWidth={1}
      borderColor="rgba(255,255,255,0.18)"
      pointerEvents="none"
    >
      <Text color="white" fontSize={12} fontWeight="700" textAlign="center">
        {notice}
      </Text>
    </YStack>
  )
}
