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

    return new Response(
      JSON.stringify({
        enabled,
        url: enabled ? livekitUrl : null,
        maxParticipants: Number.isFinite(maxParticipants) ? maxParticipants : 500,
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
