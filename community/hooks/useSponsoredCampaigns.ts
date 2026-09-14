import { useCallback, useEffect, useState } from 'react'

import {
  fetchSponsoredCampaigns,
  setSponsoredCampaignStatus,
  type SponsoredCampaign,
} from '~/community/lib/sponsored-ads'
import { useSupabase } from '~/providers/SupabaseProvider'

export function useSponsoredCampaigns() {
  const { user, isLoading: authLoading } = useSupabase()
  const [campaigns, setCampaigns] = useState<SponsoredCampaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setCampaigns([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    const result = await fetchSponsoredCampaigns()
    setCampaigns(result.data ?? [])
    setError(result.error)
    setIsLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    void refresh()
  }, [authLoading, refresh])

  const changeStatus = useCallback(
    async (
      campaignId: string,
      action: 'pause' | 'resume' | 'cancel' | 'request_refund',
    ) => {
      setActingId(campaignId)
      const result = await setSponsoredCampaignStatus(campaignId, action)
      setActingId(null)
      if (result.error) {
        setError(result.error)
        return result
      }
      if (result.data?.campaign) {
        setCampaigns((current) =>
          current.map((campaign) =>
            campaign.id === result.data?.campaign.id ? result.data.campaign : campaign,
          ),
        )
      }
      return result
    },
    [],
  )

  return {
    campaigns,
    isLoading: authLoading || isLoading,
    actingId,
    error,
    refresh,
    changeStatus,
  }
}
