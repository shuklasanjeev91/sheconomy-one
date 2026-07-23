import type { CommunitySuggestion, SuggestionKind } from '~/community/lib/community-personalization'
import { AppLink } from '~/components/navigation/AppLink'
import { suggestionKindLabel } from '~/community/lib/community-personalization'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import { brandColors } from '~/config/brand-colors'

const AVATAR_SIZE = 28
/** Reserve space for title + subtitle + reason so FlashList does not clip native text. */
const ROW_MIN_HEIGHT = 64

const KIND_ICON: Record<SuggestionKind, typeof Icons.User> = {
  person: Icons.User,
  listing: Icons.ShoppingBag,
  shop: Icons.Store,
  company: Icons.Building2,
  group: Icons.UsersRound,
  job: Icons.Briefcase,
  event: Icons.Calendar,
}

const KIND_COLOR: Record<SuggestionKind, string> = {
  person: brandColors.primary,
  listing: brandColors.primaryLight,
  shop: brandColors.coral,
  company: brandColors.primaryDark,
  group: brandColors.coral,
  job: brandColors.coral,
  event: brandColors.primaryLight,
}

export function CommunitySuggestionRow({
  item,
  showKindLabel = true,
}: {
  item: CommunitySuggestion
  showKindLabel?: boolean
}) {
  const communityUi = useCommunityUi()
  const Icon = KIND_ICON[item.kind]
  const title = item.title?.trim() ?? ''
  const subtitle = item.subtitle?.trim() ?? ''
  const reasonRaw = item.reason?.trim() ?? ''
  const reason = reasonRaw
    ? showKindLabel
      ? `${reasonRaw} · ${suggestionKindLabel(item.kind)}`
      : reasonRaw
    : ''
  const avatarName = title || subtitle || '?'

  return (
    <AppLink href={item.href as never} asChild>
      <XStack
        width="100%"
        gap={10}
        alignItems="flex-start"
        paddingVertical={8}
        paddingHorizontal={8}
        borderRadius={8}
        minHeight={ROW_MIN_HEIGHT}
        cursor="pointer"
        hoverStyle={{ backgroundColor: communityUi.divider }}
        pressStyle={{ opacity: 0.92 }}
      >
        {item.imageUrl ? (
          <YStack width={AVATAR_SIZE} height={AVATAR_SIZE} flexShrink={0} marginTop={2}>
            <Avatar name={avatarName} src={item.imageUrl} size={AVATAR_SIZE} />
          </YStack>
        ) : (
          <XStack
            width={AVATAR_SIZE}
            height={AVATAR_SIZE}
            flexShrink={0}
            marginTop={2}
            borderRadius={999}
            backgroundColor={KIND_COLOR[item.kind]}
            alignItems="center"
            justifyContent="center"
          >
            <Icon size={14} color="white" />
          </XStack>
        )}

        <YStack flex={1} minWidth={0} gap={2} justifyContent="center">
          {title ? (
            <Text
              fontSize={14}
              fontWeight="600"
              lineHeight={18}
              color={communityUi.text}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text
              fontSize={12}
              lineHeight={16}
              color={communityUi.textMuted}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          ) : null}
          {reason ? (
            <Text
              fontSize={11}
              lineHeight={14}
              fontWeight="500"
              color={communityUi.brand}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {reason}
            </Text>
          ) : null}
        </YStack>
      </XStack>
    </AppLink>
  )
}
