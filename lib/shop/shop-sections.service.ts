import { supabase } from '~/lib/supabase'

/**
 * Link a listing into a shop section (idempotent insert).
 * Used by the listing publish orchestrator and bulk import.
 */
export async function addListingToSection(
  sectionId: string,
  listingId: string,
): Promise<{ error: string | null }> {
  const sid = sectionId.trim()
  const lid = listingId.trim()
  if (!sid || !lid) return { error: 'Section and listing are required' }

  const { data: existing } = await supabase
    .from('listing_sections')
    .select('listing_id')
    .eq('section_id', sid)
    .eq('listing_id', lid)
    .maybeSingle()

  if (existing) return { error: null }

  const { error } = await supabase.from('listing_sections').insert({
    section_id: sid,
    listing_id: lid,
  })

  if (error) {
    // Unique violation / race — treat as already linked.
    if (error.code === '23505') return { error: null }
    return { error: error.message }
  }

  return { error: null }
}
