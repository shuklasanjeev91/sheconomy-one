import { Text, YStack } from '~/components/ui'
import type { ListingSpecification } from '~/lib/listing-detail'
import { useAppUi } from '~/lib/theme/useAppUi'

import { HtmlContent } from './HtmlContent'
import { ListingSpecifications } from './ListingSpecifications'

type ListingDetailsPanelProps = {
  description: string | null | undefined
  specifications: ListingSpecification[]
}

export function ListingDetailsPanel({ description, specifications }: ListingDetailsPanelProps) {
  const ui = useAppUi()
  const hasDescription = !!description?.trim()
  const hasSpecifications = specifications.length > 0

  if (!hasDescription && !hasSpecifications) return null

  return (
    <YStack gap="$6" width="100%" paddingTop="$2">
      {hasDescription ? (
        <YStack gap="$3" width="100%">
          <Text fontWeight="500" fontSize={22} color={ui.text} letterSpacing={-0.3}>
            Item description
          </Text>
          <HtmlContent html={description ?? ''} />
        </YStack>
      ) : null}

      {hasSpecifications ? <ListingSpecifications specifications={specifications} /> : null}
    </YStack>
  )
}