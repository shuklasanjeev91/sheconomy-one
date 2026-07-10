import { Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type SectionTitleProps = {
  title: string
  subtitle?: string
}

/** In-page section heading with brand accent rail. */
export function SectionTitle({ title, subtitle }: SectionTitleProps) {
  const ui = useAppUi()

  return (
    <YStack gap="$1" width="100%">
      <XStack gap="$3" alignItems="center">
        <YStack width={4} height={28} borderRadius={999} backgroundColor={ui.brand} opacity={0.9} />
        <Text fontWeight="700" fontSize={22} color={ui.text} letterSpacing={-0.4} lineHeight={28}>
          {title}
        </Text>
      </XStack>
      {subtitle ? (
        <Text color={ui.textMuted} fontSize={13} fontWeight="500" paddingLeft={19} lineHeight={18}>
          {subtitle}
        </Text>
      ) : null}
    </YStack>
  )
}
