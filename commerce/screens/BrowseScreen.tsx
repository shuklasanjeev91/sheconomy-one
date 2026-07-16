import { useParams } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { Button, YStack } from '~/components/ui'
import { InfiniteListingSection, CommercePageHeader } from '~/commerce/components'
import { BROWSE_FEED_LABELS, isBrowseFeedKind } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { FullWidthLayout, PageSection } from '~/components/layout'

export function BrowseScreen() {
  const { kind } = useParams<{ kind: string }>()

  if (!kind || !isBrowseFeedKind(kind)) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$8">
          <YStack gap="$4">
            <CommercePageHeader title="Browse page not found" subtitle="This collection doesn't exist." />
            <AppLink href={commerceRoutes.home} asChild>
              <Button tone="outline" size="$4" alignSelf="flex-start" borderRadius={999}>
                Browse marketplace
              </Button>
            </AppLink>
          </YStack>
        </PageSection>
      </FullWidthLayout>
    )
  }

  const meta = BROWSE_FEED_LABELS[kind]

  return (
    <FullWidthLayout scroll>
      <PageSection paddingVertical="$6">
        <InfiniteListingSection
          kind={kind}
          title={meta.title}
          subtitle={meta.subtitle}
        />
      </PageSection>
    </FullWidthLayout>
  )
}