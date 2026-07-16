import { Avatar, Text, XStack, YStack } from '~/components/ui'
import type { ProfileSuggestion } from '~/community/lib/network'
import { useAppUi } from '~/lib/theme/useAppUi'

type SuggestProfileRowProps = {
  profile: ProfileSuggestion
  onPress: () => void
}

export function SuggestProfileRow({ profile, onPress }: SuggestProfileRowProps) {
  const ui = useAppUi()
  const displayName = profile.full_name?.trim() || profile.username || 'member'

  return (
    <XStack
      gap="$2"
      alignItems="center"
      paddingVertical="$2.5"
      paddingHorizontal="$3"
      borderRadius={10}
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      pressStyle={{ opacity: 0.92 }}
      onPress={onPress}
    >
      <Avatar name={displayName} src={profile.avatar_url ?? undefined} size="$3" />
      <YStack flex={1} minWidth={0}>
        <Text fontSize={14} fontWeight="600" color={ui.text} numberOfLines={1}>
          {displayName}
        </Text>
        {profile.headline ? (
          <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
            {profile.headline}
          </Text>
        ) : profile.username ? (
          <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
            @{profile.username}
          </Text>
        ) : null}
      </YStack>
    </XStack>
  )
}
