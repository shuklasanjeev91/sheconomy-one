import {
  fetchProgramsByIds,
  type Program,
} from '~/class/lib/programs'
import { supabase } from '~/lib/supabase/client'

export type ProgramPlaylist = {
  id: string
  title: string
  media_type: string
  user_id: string
  created_at: string
  updated_at: string
  item_count: number
}

export type PlaylistWithPrograms = {
  playlist: ProgramPlaylist
  programs: Program[]
}

async function requireUserId(): Promise<{ userId: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.getUser()
  if (error) return { userId: null, error: error.message }
  if (!data.user) return { userId: null, error: 'Sign in to manage playlists' }
  return { userId: data.user.id, error: null }
}

export async function fetchMyPlaylists(
  mediaType?: 'video' | 'audio',
): Promise<{ playlists: ProgramPlaylist[]; error: string | null }> {
  const { userId, error: authError } = await requireUserId()
  if (!userId) return { playlists: [], error: authError }

  let query = supabase
    .from('program_playlists')
    .select('id, title, media_type, user_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (mediaType) {
    query = query.eq('media_type', mediaType)
  }

  const { data, error } = await query
  if (error) return { playlists: [], error: error.message }

  const rows = data ?? []
  const ids = rows.map((row) => row.id)
  const counts = new Map<string, number>()

  if (ids.length) {
    const { data: items } = await supabase
      .from('program_playlist_items')
      .select('playlist_id')
      .in('playlist_id', ids)

    for (const item of items ?? []) {
      counts.set(item.playlist_id, (counts.get(item.playlist_id) ?? 0) + 1)
    }
  }

  return {
    playlists: rows.map((row) => ({
      ...row,
      item_count: counts.get(row.id) ?? 0,
    })),
    error: null,
  }
}

export async function createPlaylist(
  title: string,
  mediaType: 'video' | 'audio',
): Promise<{ playlist: ProgramPlaylist | null; error: string | null }> {
  const trimmed = title.trim()
  if (!trimmed) return { playlist: null, error: 'Playlist title is required' }

  const { userId, error: authError } = await requireUserId()
  if (!userId) return { playlist: null, error: authError }

  const { data, error } = await supabase
    .from('program_playlists')
    .insert({
      title: trimmed,
      media_type: mediaType,
      user_id: userId,
    })
    .select('id, title, media_type, user_id, created_at, updated_at')
    .single()

  if (error || !data) return { playlist: null, error: error?.message ?? 'Could not create playlist' }

  return {
    playlist: { ...data, item_count: 0 },
    error: null,
  }
}

export async function renamePlaylist(
  playlistId: string,
  title: string,
): Promise<{ error: string | null }> {
  const trimmed = title.trim()
  if (!trimmed) return { error: 'Playlist title is required' }

  const { userId, error: authError } = await requireUserId()
  if (!userId) return { error: authError }

  const { error } = await supabase
    .from('program_playlists')
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq('id', playlistId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

export async function deletePlaylist(playlistId: string): Promise<{ error: string | null }> {
  const { userId, error: authError } = await requireUserId()
  if (!userId) return { error: authError }

  await supabase.from('program_playlist_items').delete().eq('playlist_id', playlistId)

  const { error } = await supabase
    .from('program_playlists')
    .delete()
    .eq('id', playlistId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

export async function addProgramToPlaylist(
  playlistId: string,
  programId: string,
): Promise<{ error: string | null }> {
  const { userId, error: authError } = await requireUserId()
  if (!userId) return { error: authError }

  const { data: owned } = await supabase
    .from('program_playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!owned) return { error: 'Playlist not found' }

  const { data: existing } = await supabase
    .from('program_playlist_items')
    .select('program_id')
    .eq('playlist_id', playlistId)
    .eq('program_id', programId)
    .maybeSingle()

  if (existing) return { error: null }

  const { data: last } = await supabase
    .from('program_playlist_items')
    .select('sort_order')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (last?.sort_order ?? -1) + 1

  const { error } = await supabase.from('program_playlist_items').insert({
    playlist_id: playlistId,
    program_id: programId,
    sort_order: sortOrder,
  })

  if (!error) {
    await supabase
      .from('program_playlists')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', playlistId)
  }

  return { error: error?.message ?? null }
}

export async function removeProgramFromPlaylist(
  playlistId: string,
  programId: string,
): Promise<{ error: string | null }> {
  const { userId, error: authError } = await requireUserId()
  if (!userId) return { error: authError }

  const { data: owned } = await supabase
    .from('program_playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!owned) return { error: 'Playlist not found' }

  const { error } = await supabase
    .from('program_playlist_items')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('program_id', programId)

  return { error: error?.message ?? null }
}

export async function fetchPlaylistWithPrograms(
  playlistId: string,
): Promise<{ result: PlaylistWithPrograms | null; error: string | null }> {
  const { data: playlist, error } = await supabase
    .from('program_playlists')
    .select('id, title, media_type, user_id, created_at, updated_at')
    .eq('id', playlistId)
    .maybeSingle()

  if (error) return { result: null, error: error.message }
  if (!playlist) return { result: null, error: 'Playlist not found' }

  const { data: items, error: itemsError } = await supabase
    .from('program_playlist_items')
    .select('program_id, sort_order')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: true })

  if (itemsError) return { result: null, error: itemsError.message }

  const orderedIds = (items ?? []).map((item) => item.program_id)
  const { programs, error: programsError } = await fetchProgramsByIds(orderedIds)

  return {
    result: {
      playlist: { ...playlist, item_count: programs.length },
      programs,
    },
    error: programsError,
  }
}

export async function isProgramInPlaylist(
  playlistId: string,
  programId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('program_playlist_items')
    .select('program_id')
    .eq('playlist_id', playlistId)
    .eq('program_id', programId)
    .maybeSingle()
  return Boolean(data)
}
