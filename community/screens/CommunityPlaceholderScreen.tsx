import { Text, YStack } from '~/components/ui'
import { AppPage, SurfaceCard } from '~/components/layout'
import { useAppUi } from '~/lib/theme/useAppUi'

type PlaceholderScreenProps = {
  title: string
  description: string
}

export function CommunityPlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  const ui = useAppUi()

  return (
    <AppPage scroll paddingVertical="$6">
      <SurfaceCard padding="$6" gap="$3">
        <Text fontSize={28} fontWeight="700" color={ui.text} letterSpacing={-0.5}>
          {title}
        </Text>
        <Text fontSize={16} color={ui.textSecondary} lineHeight={24}>
          {description}
        </Text>
      </SurfaceCard>
    </AppPage>
  )
}