import { supabase } from '~/lib/supabase/client'

export async function fetchMutualConnectionsCount(
  user1Id: string,
  user2Id: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('get_mutual_connections_count', {
    user1_id: user1Id,
    user2_id: user2Id,
  })

  if (error) return 0
  return typeof data === 'number' ? data : 0
}
