import { AppPage, AppPageHeader, SurfaceCard } from '~/components/layout'

type PlaceholderScreenProps = {
  title: string
  description: string
}

export function CommunityPlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <AppPage scroll paddingVertical="$6">
      <SurfaceCard padding="$6" gap="$4">
        <AppPageHeader title={title} subtitle={description} />
      </SurfaceCard>
    </AppPage>
  )
}
