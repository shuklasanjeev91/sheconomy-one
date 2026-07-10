import { Text, YStack } from '~/components/ui'
import type { ListingSpecification } from '~/lib/listing-detail'

import { HtmlContent } from './HtmlContent'
import { ListingSpecifications } from './ListingSpecifications'
import { SectionTitle } from './SectionTitle'

type ListingDetailsPanelProps = {
  description: string | null | undefined
  specifications: ListingSpecification[]
}

export function ListingDetailsPanel({ description, specifications }: ListingDetailsPanelProps) {
  const hasDescription = !!description?.trim()
  const hasSpecifications = specifications.length > 0

  if (!hasDescription && !hasSpecifications) return null

  return (
    <YStack gap="$6" width="100%" paddingTop="$2">
      {hasDescription ? (
        <YStack gap="$3" width="100%">
          <SectionTitle title="Item description" />
          <HtmlContent html={description ?? ''} />
        </YStack>
      ) : null}

      {hasSpecifications ? <ListingSpecifications specifications={specifications} /> : null}
    </YStack>
  )
}