import { useEffect, useState } from 'react'

import { supabase } from '~/lib/supabase/client'

export type PeerPresence = {
  isOnline: boolean
  lastSeen: string | null
}

/**
 * Live online / last-seen status for the other participant in a direct chat.
 * Seeds from the list snapshot, then follows realtime `profiles` updates.
 */
export function usePeerPresence(
  otherUserId: string | null | undefined,
  seed?: PeerPresence,
): PeerPresence {
  const [presence, setPresence] = useState<PeerPresence>(
    seed ?? { isOnline: false, lastSeen: null },
  )

  useEffect(() => {
    if (seed) setPresence(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.isOnline, seed?.lastSeen])

  useEffect(() => {
    if (!otherUserId) return

    let cancelled = false

    supabase
      .from('profiles')
      .select('is_online, last_seen')
      .eq('id', otherUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setPresence({ isOnline: !!data.is_online, lastSeen: data.last_seen ?? null })
      })

    const channel = supabase
      .channel(`presence:${otherUserId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${otherUserId}` },
        (payload) => {
          const row = payload.new as { is_online?: boolean; last_seen?: string | null }
          setPresence({ isOnline: !!row.is_online, lastSeen: row.last_seen ?? null })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [otherUserId])

  return presence
}
