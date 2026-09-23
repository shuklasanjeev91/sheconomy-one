import { AppBottomSheet, Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { BRAND_NAME } from '~/config/brand'
import { HUMAN_VERIFICATION_DISCLAIMER } from '~/lib/gender-verification'
import { useAppUi } from '~/lib/theme/useAppUi'

type GenderDeniedModalProps = {
  open: boolean
  onClose: () => void
  onVerify: () => void
}

/** Access-restricted bottom sheet with a path into Human verification. */
export function GenderDeniedModal({ open, onClose, onVerify }: GenderDeniedModalProps) {
  const ui = useAppUi()

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Access restricted"
      showHandle
      scrollable
      footer={
        <YStack gap="$2.5" width="100%">
          <Button tone="primary" size="$4" borderRadius={radius.pill} onPress={onVerify}>
            Start human verification
          </Button>
          <Button tone="outline" size="$4" borderRadius={radius.pill} onPress={onClose}>
            Skip — continue browsing
          </Button>
        </YStack>
      }
    >
      <YStack gap="$4">
        <XStack alignItems="center" gap="$3">
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
          <Text fontSize={13} color={ui.textMuted} flex={1}>
            Human verification required
          </Text>
        </XStack>

        <YStack padding="$3.5" borderRadius={radius.chip} backgroundColor={ui.roseSurface} gap="$1.5">
          <Text fontSize={15} fontWeight="700" color={ui.text}>
            This space is for verified women
          </Text>
          <Text fontSize={13} color={ui.textSecondary} lineHeight={20}>
            Community, Chat, and some seller tools stay locked until you complete Human verification.
            You can skip and still use Commerce, Classes, and Co-Work.
          </Text>
        </YStack>

        <YStack padding="$3.5" borderRadius={radius.chip} backgroundColor={ui.surfaceMuted} gap="$2">
          <Text fontSize={13} fontWeight="700" color={ui.text}>
            Our commitment
          </Text>
          <Text fontSize={12} color={ui.textSecondary} lineHeight={18}>
            {HUMAN_VERIFICATION_DISCLAIMER}
          </Text>
        </YStack>

        <YStack padding="$3.5" borderRadius={radius.chip} backgroundColor={ui.surfaceMuted} gap="$2">
          <Text fontSize={13} fontWeight="700" color={ui.text}>
            What you can still do
          </Text>
          {[
            'Browse and purchase products',
            'Join Classes and Co-Work sessions',
            'Support women-owned businesses',
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
      </YStack>
    </AppBottomSheet>
  )
}
