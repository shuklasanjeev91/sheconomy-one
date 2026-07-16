import { ListingErrorBoundary } from '~/commerce/components/ListingErrorBoundary'
import { VendorListingsScreen } from '~/commerce/screens/vendor/VendorListingsScreen'
import { loadShopListings } from '~/lib/listing/listing.store'
import { useAppDispatch } from '~/lib/store/hooks'

export default function VendorProductsRoute() {
  const dispatch = useAppDispatch()

  return (
    <ListingErrorBoundary
      scope="VendorListings"
      onReset={() => {
        // Reload is handled inside the screen once shop context is available.
        void dispatch(loadShopListings({ shopId: '', query: {} })).catch(() => undefined)
      }}
    >
      <VendorListingsScreen />
    </ListingErrorBoundary>
  )
}
