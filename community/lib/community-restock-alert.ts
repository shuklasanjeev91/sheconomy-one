import { isStockAlertSubscribed, subscribeStockAlert } from '~/commerce/lib/stock-alerts'

export async function subscribeCommunityRestockAlert(
  listingId: string,
  userId: string,
): Promise<{ error: string | null; alreadySubscribed: boolean }> {
  const subscribed = await isStockAlertSubscribed(listingId, userId)
  if (subscribed) {
    return { error: null, alreadySubscribed: true }
  }
  const { error } = await subscribeStockAlert(listingId, userId)
  return { error: error ?? null, alreadySubscribed: false }
}
