import { AddressErrorBoundary } from '~/commerce/components/AddressErrorBoundary'
import { AddressManager } from '~/commerce/components/address/AddressManager'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import { YStack } from '~/components/ui'
import { loadAddresses } from '~/lib/address/address.store'
import { useAppDispatch } from '~/lib/store/hooks'

export function AddressesScreen() {
  const dispatch = useAppDispatch()

  return (
    <AddressErrorBoundary
      scope="AddressesScreen"
      onReset={() => void dispatch(loadAddresses({ forceRefresh: true }))}
    >
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$6" {...LAYOUT_STRETCH}>
          <YStack gap="$6" width="100%" maxWidth="100%" alignSelf="stretch">
            <AddressManager
              title="Delivery addresses"
              subtitle="Add, edit, and manage shipping, billing, and personal addresses."
            />
          </YStack>
        </PageSection>
      </FullWidthLayout>
    </AddressErrorBoundary>
  )
}
