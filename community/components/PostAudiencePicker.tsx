import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useCommunityUi } from '~/community/lib/community-theme'
import {
  POST_AUDIENCES,
  POST_VISIBILITY_OPTIONS,
  normalizePostVisibility,
  type PostVisibility,
} from '~/community/lib/post-visibility'

export function PostAudienceMark({
  visibility,
  color,
}: {
  visibility?: string | null
  color: string
}) {
  const audience = normalizePostVisibility(visibility)
  const Icon = postAudienceIcon(audience)
  return <Icon size={12} color={color} accessibilityLabel={POST_AUDIENCES[audience].label} />
}

export function postAudienceIcon(visibility: PostVisibility) {
  if (visibility === 'connections') return Icons.Users
  if (visibility === 'private') return Icons.Lock
  return Icons.Globe
}

export function PostAudiencePicker({
  value,
  onChange,
}: {
  value: PostVisibility
  onChange: (next: PostVisibility) => void
}) {
  const communityUi = useCommunityUi()

  return (
    <YStack gap={4}>
      <Text fontSize={12} fontWeight="700" color={communityUi.textMuted} paddingHorizontal={6}>
        Who can see this
      </Text>
      {POST_VISIBILITY_OPTIONS.map((key) => {
        const item = POST_AUDIENCES[key]
        const Icon = postAudienceIcon(key)
        const selected = value === key
        return (
          <XStack
            key={key}
            alignItems="center"
            gap={12}
            paddingVertical={12}
            paddingHorizontal={6}
            borderRadius={12}
            cursor="pointer"
            hoverStyle={{ backgroundColor: communityUi.hoverBg }}
            pressStyle={{ backgroundColor: communityUi.hoverBg, opacity: 0.9 }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => onChange(key)}
          >
            <XStack
              width={40}
              height={40}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor={communityUi.accentMuted}
            >
              <Icon size={20} color={communityUi.brand} />
            </XStack>
            <YStack flex={1} gap={2}>
              <Text fontSize={15} fontWeight="700" color={communityUi.text}>
                {item.label}
              </Text>
              <Text fontSize={12} color={communityUi.textMuted}>
                {item.description}
              </Text>
            </YStack>
            {selected ? <Icons.Check size={20} color={communityUi.brand} /> : null}
          </XStack>
        )
      })}
    </YStack>
  )
}
