import { useLoader } from 'one'

import { ShopScreen } from '~/commerce/screens/ShopScreen'
import { shopLoader } from '~/commerce/lib/shop-loader'

export async function loader(props: Parameters<typeof shopLoader>[0]) {
  return shopLoader(props)
}

export default function ShopPage() {
  const initial = useLoader(loader)
  return <ShopScreen initial={initial} />
}
