import { fetchNetworkSummary, type NetworkSummary } from '~/community/lib/network'

const NETWORK_FRESH_MS = 60_000

let cached: { userId: string; summary: NetworkSummary; at: number } | null = null
let inflight: Promise<NetworkSummary> | null = null

export function invalidateNetworkSummary(userId?: string): void {
  if (!userId || cached?.userId === userId) {
    cached = null
  }
}

/** Shared network summary — invitations + suggestions strips reuse one fetch. */
export async function fetchNetworkSummaryCached(userId: string): Promise<NetworkSummary> {
  if (cached?.userId === userId && Date.now() - cached.at < NETWORK_FRESH_MS) {
    return cached.summary
  }

  if (inflight) return inflight

  inflight = fetchNetworkSummary(userId)
    .then((summary) => {
      cached = { userId, summary, at: Date.now() }
      return summary
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}
