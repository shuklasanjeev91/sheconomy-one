import { Link, useParams } from 'one'

import { Button, Text, YStack } from '~/components/ui'
import { InfiniteListingSection } from '~/commerce/components'
import { BROWSE_FEED_LABELS, isBrowseFeedKind } from '~/lib/supabase/commerce'
import { commerceRoutes } from '~/lib/routes'
import { FullWidthLayout, PageSection } from '~/components/layout'
import { useAppUi } from '~/lib/theme/useAppUi'

export function BrowseScreen() {
  const ui = useAppUi()
  const { kind } = useParams<{ kind: string }>()

  if (!kind || !isBrowseFeedKind(kind)) {
    return (
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$8">
          <YStack gap="$4">
            <Text fontWeight="500" fontSize={22} color={ui.text}>
              Browse page not found
            </Text>
            <Link href={commerceRoutes.home} asChild>
              <Button tone="outline" size="$4" alignSelf="flex-start" borderRadius={999}>
                Back to home
              </Button>
            </Link>
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