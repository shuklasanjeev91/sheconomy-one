import { Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type ReadyToSellSectionProps = {
  onScrollToForm: () => void
}

export function ReadyToSellSection({ onScrollToForm }: ReadyToSellSectionProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  return (
    <YStack
      paddingVertical={isDesktop ? 24 : 16}
      paddingHorizontal={isDesktop ? '$8' : '$4'}
      backgroundColor={ui.background}
    >
      <XStack
        maxWidth={1100}
        alignSelf="center"
        width="100%"
        backgroundColor="#db2777"
        borderRadius={radius.card}
        paddingHorizontal={isDesktop ? '$8' : '$5'}
        paddingVertical="$6"
        alignItems={isDesktop ? 'center' : 'flex-start'}
        justifyContent="space-between"
        flexDirection={isDesktop ? 'row' : 'column'}
        gap="$5"
      >
        <YStack gap="$1.5">
          <Text fontSize={isDesktop ? 28 : 22} fontWeight="900" color="white">
            Ready to Start Selling?
          </Text>
          <Text fontSize={isDesktop ? 16 : 14} color="rgba(255,255,255,0.85)">
            Join thousands of women entrepreneurs growing their businesses on SHEconomy.
          </Text>
        </YStack>

        <XStack
          onPress={onScrollToForm}
          cursor="pointer"
          alignItems="center"
          gap="$2"
          borderWidth={2}
          borderColor="white"
          paddingHorizontal="$5"
          paddingVertical="$3"
          borderRadius={radius.pill}
          hoverStyle={{ backgroundColor: 'white' }}
          pressStyle={{ opacity: 0.85 }}
          alignSelf={isDesktop ? 'center' : 'flex-start'}
        >
          <Text fontWeight="700" color="white" fontSize={14}>
            Create Your Store
          </Text>
          <Icons.ArrowRight size={16} color="white" />
        </XStack>
      </XStack>
    </YStack>
  )
}
