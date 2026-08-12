import { useLocalSearchParams } from 'one'

import { SharedWishlistScreen } from '~/commerce/screens/SharedWishlistScreen'

export default function SharedWishlistRoute() {
  const params = useLocalSearchParams<{ token?: string | string[] }>()
  const raw = params.token
  const token = Array.isArray(raw) ? raw[0] ?? '' : raw ?? ''
  return <SharedWishlistScreen token={token} />
}
