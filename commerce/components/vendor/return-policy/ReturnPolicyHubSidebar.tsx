import { Icons, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import {
  RETURN_POLICY_GUIDELINE_ITEMS,
  RETURN_POLICY_UI_COPY,
} from '~/lib/return-policy/return-policy-ui.copy'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ReturnPolicyHubSidebarProps = {
  ui: AppUiTokens
}

export function ReturnPolicyHubSidebar({ ui }: ReturnPolicyHubSidebarProps) {
  return (
    <YStack gap="$4" width="100%">
      <YStack
        gap="$3"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        style={getShadowStyle('sm')}
      >
        <Text fontSize={15} fontWeight="800" color={ui.text}>
          {RETURN_POLICY_UI_COPY.guidelinesTitle}
        </Text>
        <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
          {RETURN_POLICY_UI_COPY.guidelinesIntro}
        </Text>
        <YStack gap="$2.5">
          {RETURN_POLICY_GUIDELINE_ITEMS.map((item) => (
            <XStack key={item.id} alignItems="center" gap="$2.5">
              <YStack
                width={22}
                height={22}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                backgroundColor={item.completed ? ui.roseSurface : ui.surfaceMuted}
                borderWidth={1}
                borderColor={item.completed ? `${ui.brand}44` : ui.borderSubtle}
              >
                {item.completed ? (
                  <Icons.Check size={13} color={ui.brand} />
                ) : (
                  <YStack width={8} height={8} borderRadius={999} backgroundColor={ui.borderSubtle} />
                )}
              </YStack>
              <Text fontSize={13} fontWeight="600" color={ui.text}>
                {RETURN_POLICY_UI_COPY[item.labelKey]}
              </Text>
            </XStack>
          ))}
        </YStack>
        <YStack
          padding="$3"
          borderRadius={radius.chip}
          backgroundColor={ui.surfaceMuted}
          borderWidth={1}
          borderColor={ui.borderSubtle}
        >
          <Text fontSize={12.5} color={ui.textSecondary} fontStyle="italic" lineHeight={19}>
            “{RETURN_POLICY_UI_COPY.guidelinesQuote}”
          </Text>
        </YStack>
      </YStack>

      <YStack
        gap="$2.5"
        padding="$4"
        borderRadius={radius.card}
        backgroundColor={ui.brand}
        style={getShadowStyle('md')}
      >
        <XStack alignItems="center" gap="$2">
          <Icons.Award size={18} color={ui.onBrand} />
          <Text fontSize={11} fontWeight="800" color={ui.onBrand} letterSpacing={0.5}>
            {RETURN_POLICY_UI_COPY.trustSignalLevel}
          </Text>
        </XStack>
        <Text fontSize={14} fontWeight="700" color={ui.onBrand} lineHeight={21}>
          {RETURN_POLICY_UI_COPY.trustSignalBody}
        </Text>
      </YStack>
    </YStack>
  )
}
