import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const livekitUrl = Deno.env.get('LIVEKIT_URL') ?? ''
    const apiKey = Deno.env.get('LIVEKIT_API_KEY') ?? ''
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET') ?? ''
    const maxParticipants = Number(Deno.env.get('LIVEKIT_MAX_PARTICIPANTS') ?? '500')

    const enabled = Boolean(livekitUrl && apiKey && apiSecret)

    // Recording requires Supabase Storage S3 access keys so that LiveKit Egress
    // can push MP4 files into the private `meeting-recordings` bucket.
    // Accept all naming conventions — SUPABASE_S3_ACCESS_KEY_ID (recommended),
    // S3_ACCESS_KEY_ID (short form), and LIVEKIT_EGRESS_S3_ACCESS_KEY (legacy).
    const s3AccessKey =
      Deno.env.get('SUPABASE_S3_ACCESS_KEY_ID') ||
      Deno.env.get('S3_ACCESS_KEY_ID') ||
      Deno.env.get('LIVEKIT_EGRESS_S3_ACCESS_KEY')
    const s3Secret =
      Deno.env.get('SUPABASE_S3_SECRET_ACCESS_KEY') ||
      Deno.env.get('S3_SECRET_ACCESS_KEY') ||
      Deno.env.get('LIVEKIT_EGRESS_S3_SECRET')
    const recordingConfigured = Boolean(enabled && s3AccessKey && s3Secret)

    return new Response(
      JSON.stringify({
        enabled,
        url: enabled ? livekitUrl : null,
        maxParticipants: Number.isFinite(maxParticipants) ? maxParticipants : 500,
        // Tells the client whether cloud recording storage is ready.
        // When false, the Record button is hidden / disabled for hosts.
        recordingConfigured,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('livekit-config error:', error)
    return new Response(JSON.stringify({ enabled: false, error: 'Failed to load LiveKit config.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
