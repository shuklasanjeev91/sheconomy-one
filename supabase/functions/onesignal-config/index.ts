import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

/**
 * Public OneSignal config for web / iOS / Android clients.
 * Exposes only ONESIGNAL_APP_ID (never the REST API key).
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const appId = (Deno.env.get('ONESIGNAL_APP_ID') ?? '').trim()
    const safariWebId = (Deno.env.get('ONESIGNAL_SAFARI_WEB_ID') ?? '').trim()
    const enabled = appId.length > 0

    return new Response(
      JSON.stringify({
        enabled,
        appId: enabled ? appId : null,
        safariWebId: safariWebId.length > 0 ? safariWebId : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('onesignal-config error:', error)
    return new Response(
      JSON.stringify({ enabled: false, appId: null, error: 'Failed to load OneSignal config.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
