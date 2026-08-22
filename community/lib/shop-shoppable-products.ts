import { fetchProfileShoppableProducts } from '~/community/lib/profile-shoppable-products'
import type { PostProduct } from '~/community/lib/community'

/** Products from a shop owner's community posts, scoped to one shop. */
export async function fetchShopShoppableProducts(
  shopId: string,
  ownerUserId: string,
  limit = 12,
): Promise<PostProduct[]> {
  const products = await fetchProfileShoppableProducts(ownerUserId, limit * 2)
  return products.filter((product) => product.shopId === shopId).slice(0, limit)
}
