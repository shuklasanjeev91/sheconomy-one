import { useParams } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { Button, YStack } from '~/components/ui'
import { InfiniteListingSection, CommercePageHeader } from '~/commerce/components'
import { MarketplacePage } from '~/commerce/components/marketplace-shell'
import { BROWSE_FEED_LABELS, isBrowseFeedKind } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { useAppLayout } from '~/hooks/useAppLayout'

export function BrowseScreen() {
  const { kind } = useParams<{ kind: string }>()
  const { hasSideRails } = useAppLayout()

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
      <PageSection paddingVertical="$5" paddingHorizontal={hasSideRails ? '$4' : '$3'}>
        <MarketplacePage hasSideRails={hasSideRails} flush>
          <YStack gap="$4" width="100%">
            <CommercePageHeader title={meta.title} subtitle={meta.subtitle} />
            <InfiniteListingSection
              kind={kind}
              title={meta.title}
              subtitle={meta.subtitle}
              hideHeader
            />
          </YStack>
        </MarketplacePage>
      </PageSection>
    </FullWidthLayout>
  )
}
