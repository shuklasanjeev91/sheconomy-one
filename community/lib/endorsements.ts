import { supabase } from '~/lib/supabase/client'
import { notifyFromTemplate } from '~/lib/notifications/notify'

/** Toggle a skill endorsement from the signed-in viewer. */
export async function endorseSkill(options: {
  skillOwnerId: string
  skillName: string
  endorserId: string
}): Promise<{ error: string | null; endorsed: boolean }> {
  if (options.skillOwnerId === options.endorserId) {
    return { error: 'You cannot endorse your own skill.', endorsed: false }
  }

  const { data: existing } = await supabase
    .from('skill_endorsements')
    .select('id')
    .eq('user_id', options.skillOwnerId)
    .eq('skill_name', options.skillName)
    .eq('endorsed_by', options.endorserId)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase.from('skill_endorsements').delete().eq('id', existing.id)
    if (!error) {
      await adjustEndorsementCount(options.skillOwnerId, options.skillName, -1)
    }
    return { error: error?.message ?? null, endorsed: false }
  }

  const { error } = await supabase.from('skill_endorsements').insert({
    user_id: options.skillOwnerId,
    skill_name: options.skillName,
    endorsed_by: options.endorserId,
  })

  if (error) return { error: error.message, endorsed: false }

  await adjustEndorsementCount(options.skillOwnerId, options.skillName, 1)

  const [{ data: endorser }, { data: owner }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', options.endorserId)
      .maybeSingle(),
    supabase.from('profiles').select('username').eq('id', options.skillOwnerId).maybeSingle(),
  ])

  void notifyFromTemplate({
    templateKey: 'skill_endorsed',
    recipientId: options.skillOwnerId,
    contextType: 'profile',
    contextId: options.skillOwnerId,
    variables: {
      endorser_name: endorser?.full_name || endorser?.username || 'Someone',
      skill_name: options.skillName,
      action_url: `/profile/${owner?.username || options.skillOwnerId}`,
    },
    channels: ['in_app', 'email', 'push'],
  })

  return { error: null, endorsed: true }
}

export async function hasEndorsedSkill(
  skillOwnerId: string,
  skillName: string,
  endorserId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('skill_endorsements')
    .select('id')
    .eq('user_id', skillOwnerId)
    .eq('skill_name', skillName)
    .eq('endorsed_by', endorserId)
    .maybeSingle()
  return !!data
}

async function adjustEndorsementCount(userId: string, skillName: string, delta: number) {
  const { data } = await supabase
    .from('skills')
    .select('id, endorsements_count')
    .eq('user_id', userId)
    .eq('skill_name', skillName)
    .maybeSingle()
  if (!data?.id) return
  const next = Math.max(0, (data.endorsements_count ?? 0) + delta)
  await supabase.from('skills').update({ endorsements_count: next }).eq('id', data.id)
}
