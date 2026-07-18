import { createClient } from 'jsr:@supabase/supabase-js@2'

/** Private Supabase Storage bucket that holds meeting recording MP4s. */
export const MEETING_RECORDINGS_BUCKET =
  Deno.env.get('MEETING_RECORDINGS_BUCKET') || 'meeting-recordings'

export type EgressS3Config = {
  bucket: string
  region: string
  accessKey: string
  secret: string
  endpoint: string
  forcePathStyle: boolean
}

/**
 * LiveKit Egress uploads through Supabase Storage's S3-compatible endpoint
 * (`{SUPABASE_URL}/storage/v1/s3`) so recordings land in the Supabase bucket,
 * not an external S3 bucket. The access key pair is generated in the Supabase
 * dashboard under Storage settings → S3 access keys.
 */
export function readEgressS3Config(): EgressS3Config | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const accessKey =
    Deno.env.get('SUPABASE_S3_ACCESS_KEY_ID') || Deno.env.get('LIVEKIT_EGRESS_S3_ACCESS_KEY')
  const secret =
    Deno.env.get('SUPABASE_S3_SECRET_ACCESS_KEY') || Deno.env.get('LIVEKIT_EGRESS_S3_SECRET')
  if (!supabaseUrl || !accessKey || !secret) return null

  return {
    bucket: MEETING_RECORDINGS_BUCKET,
    // Supabase Storage S3 protocol expects the project region.
    region: Deno.env.get('SUPABASE_STORAGE_REGION') || 'ap-south-1',
    accessKey,
    secret,
    endpoint: `${supabaseUrl.replace(/\/$/, '')}/storage/v1/s3`,
    forcePathStyle: true,
  }
}

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
