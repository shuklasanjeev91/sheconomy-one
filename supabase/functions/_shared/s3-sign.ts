import { createClient } from 'jsr:@supabase/supabase-js@2'

/** Private Supabase Storage bucket that holds meeting recording MP4s. */
export const MEETING_RECORDINGS_BUCKET =
  Deno.env.get('MEETING_RECORDINGS_BUCKET') || 'meeting-recordings'

function serviceStorageClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service credentials are not configured.')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

async function createSignedStorageUrl(
  storagePath: string,
  expiresInSeconds: number,
  download?: string,
): Promise<string> {
  const client = serviceStorageClient()
  const { data, error } = await client.storage
    .from(MEETING_RECORDINGS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds, download ? { download } : undefined)

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Could not sign recording URL.')
  }
  return data.signedUrl
}

export async function createRecordingDownloadUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  const filename = storagePath.split('/').pop() || 'recording.mp4'
  return createSignedStorageUrl(storagePath, expiresInSeconds, filename)
}

export async function createRecordingPlaybackUrl(
  storagePath: string,
  expiresInSeconds = 60 * 30,
): Promise<string> {
  return createSignedStorageUrl(storagePath, expiresInSeconds)
}
