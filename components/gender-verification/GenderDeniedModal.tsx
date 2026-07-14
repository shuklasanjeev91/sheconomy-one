import { Platform } from 'react-native'

import { Button, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { BRAND_NAME } from '~/config/brand'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type GenderDeniedModalProps = {
  open: boolean
  /** Acknowledge and dismiss ("I understand"). */
  onClose: () => void
  /** Kick off verification instead ("Verify myself"). */
  onVerify: () => void
}

/**
 * "Access restricted" modal shown when someone reaches a women-first feature
 * they can't use yet (e.g. via `?gender=restricted`). Explains what limited
 * access still allows and offers a path to verify. Migrated from the legacy
 * `gender-denied-modal`, restyled with the app's brand tokens.
 */
export function GenderDeniedModal({ open, onClose, onVerify }: GenderDeniedModalProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  if (!open) return null

  return (
    <YStack
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={200_010}
      backgroundColor="rgba(0,0,0,0.55)"
      alignItems="center"
      justifyContent={isDesktop ? 'center' : 'flex-end'}
      padding={isDesktop ? '$4' : 0}
    >
      <YStack
        width="100%"
        maxWidth={isDesktop ? 460 : undefined}
        flex={isDesktop ? undefined : 1}
        maxHeight={isDesktop ? '90%' : undefined}
        backgroundColor={ui.surface}
        borderRadius={isDesktop ? radius.card : 0}
        borderWidth={isDesktop ? 1 : 0}
        borderColor={ui.borderSubtle}
        overflow="hidden"
        style={isDesktop ? getShadowStyle('lg') : undefined}
      >
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3.5"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSubtle}
          backgroundColor={ui.background}
        >
          <XStack alignItems="center" gap="$3" flex={1}>
            <YStack
              width={40}
              height={40}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor={ui.roseSurface}
            >
              <Icons.AlertTriangle size={20} color={ui.brand} />
            </YStack>
            <YStack flex={1}>
              <Text fontSize={16} fontWeight="800" color={ui.text}>
                Access restricted
              </Text>
              <Text fontSize={12} color={ui.textMuted}>
                This feature is women-first
              </Text>
            </YStack>
          </XStack>
          <Button
            size="$2"
            circular
            chromeless
            onPress={onClose}
            aria-label="Close"
            icon={<Icons.X size={20} color={ui.textSecondary} />}
          />
        </XStack>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false}>
          <YStack
            padding="$3.5"
            borderRadius={radius.chip}
            backgroundColor={ui.roseSurface}
            gap="$1.5"
          >
            <Text fontSize={15} fontWeight="700" color={ui.text}>
              This platform is built for women
            </Text>
            <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
              Our marketplace and community are designed to support women entrepreneurs and business
              owners. Some seller features stay locked until you verify.
            </Text>
          </YStack>

          <YStack
            padding="$3.5"
            borderRadius={radius.chip}
            backgroundColor={ui.surfaceMuted}
            gap="$2"
          >
            <Text fontSize={13} fontWeight="700" color={ui.text}>
              What you can still do
            </Text>
            {[
              'Browse and purchase products',
              'Support women-owned businesses',
              'Access community and educational content',
            ].map((item) => (
              <XStack key={item} gap="$2" alignItems="flex-start">
                <Icons.Check size={15} color={ui.brand} />
                <Text fontSize={13} color={ui.textSecondary} flex={1} lineHeight={19}>
                  {item}
                </Text>
              </XStack>
            ))}
          </YStack>

          <Text fontSize={12} color={ui.textMuted} textAlign="center" lineHeight={18}>
            Thank you for understanding and supporting women in business on {BRAND_NAME}.
          </Text>

          <YStack gap="$2.5">
            <Button tone="primary" size="$4" borderRadius={radius.pill} onPress={onVerify}>
              Verify myself
            </Button>
            <Button tone="outline" size="$4" borderRadius={radius.pill} onPress={onClose}>
              I understand
            </Button>
          </YStack>
        </ScrollView>
      </YStack>
    </YStack>
  )
}
