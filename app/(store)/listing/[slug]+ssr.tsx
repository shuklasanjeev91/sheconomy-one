import { useLoader } from 'one'

import { ListingScreen } from '~/commerce/screens/ListingScreen'
import { listingLoader } from '~/commerce/lib/listing-loader'

export async function loader(props: Parameters<typeof listingLoader>[0]) {
  return listingLoader(props)
}

export default function ListingDetailPage() {
  const initial = useLoader(loader)
  return <ListingScreen initial={initial} />
}
