import { Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type CallToActionSectionProps = {
  onScrollToForm: () => void
}

export function CallToActionSection({ onScrollToForm }: CallToActionSectionProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  return (
    <YStack
      paddingVertical={isDesktop ? 24 : 16}
      paddingHorizontal={isDesktop ? '$8' : '$4'}
      backgroundColor={ui.surfaceMuted}
    >
      <XStack
        maxWidth={1100}
        alignSelf="center"
        width="100%"
        backgroundColor="#f57c45"
        borderRadius={radius.card}
        paddingHorizontal={isDesktop ? '$10' : '$5'}
        paddingVertical={isDesktop ? '$8' : '$6'}
        alignItems={isDesktop ? 'center' : 'flex-start'}
        justifyContent="space-between"
        flexDirection={isDesktop ? 'row' : 'column'}
        gap="$5"
      >
        <YStack gap="$1.5" flex={1}>
          <Text fontSize={isDesktop ? 36 : 26} fontWeight="900" color="white">
            You Belong Here
          </Text>
          <Text fontSize={isDesktop ? 17 : 14} color="rgba(255,255,255,0.9)" lineHeight={24}>
            Take the first step towards building your dream business today.
          </Text>
        </YStack>

        <XStack
          onPress={onScrollToForm}
          cursor="pointer"
          alignItems="center"
          gap="$2"
          borderWidth={2}
          borderColor="white"
          paddingHorizontal={isDesktop ? '$6' : '$5'}
          paddingVertical="$3"
          borderRadius={radius.pill}
          hoverStyle={{ backgroundColor: 'white' }}
          pressStyle={{ opacity: 0.85 }}
          alignSelf={isDesktop ? 'center' : 'flex-start'}
          flexShrink={0}
        >
          <Text fontWeight="700" color="white" fontSize={isDesktop ? 16 : 14}>
            Join SHEconomy
          </Text>
          <Icons.ArrowRight size={18} color="white" />
        </XStack>
      </XStack>
    </YStack>
  )
}
