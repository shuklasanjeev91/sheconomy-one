import { AddressErrorBoundary } from '~/commerce/components/AddressErrorBoundary'
import { AddressManager } from '~/commerce/components/address/AddressManager'
import { MarketplacePage } from '~/commerce/components'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection } from '~/components/layout'
import { useAppLayout } from '~/hooks/useAppLayout'
import { loadAddresses } from '~/lib/address/address.store'
import { useAppDispatch } from '~/lib/store/hooks'

export function AddressesScreen() {
  const dispatch = useAppDispatch()
  const { hasSideRails } = useAppLayout()

  return (
    <AddressErrorBoundary
      scope="AddressesScreen"
      onReset={() => void dispatch(loadAddresses({ forceRefresh: true }))}
    >
      <FullWidthLayout scroll>
        <PageSection paddingVertical="$5" {...LAYOUT_STRETCH}>
          <MarketplacePage hasSideRails={hasSideRails}>
            <AddressManager
              title="Addresses"
              subtitle="Add, edit, and manage shipping, billing, and personal addresses."
            />
          </MarketplacePage>
        </PageSection>
      </FullWidthLayout>
    </AddressErrorBoundary>
  )
}
