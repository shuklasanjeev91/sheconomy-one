import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

import { corsHeaders, jsonResponse } from '~/supabase/functions/_shared/cors.ts'

const BUCKET = 'post-images'
const PUBLIC_MARKER = `/object/public/${BUCKET}/`

function pathFromPublicUrl(url: string | null): string | null {
  if (!url) return null
  const idx = url.indexOf(PUBLIC_MARKER)
  if (idx < 0) return null
  try {
    return decodeURIComponent(url.slice(idx + PUBLIC_MARKER.length))
  } catch {
    return null
  }
}

/**
 * Deletes storage objects + hard-deletes story rows expired more than grace hours ago.
 * Intended for cron / manual ops with the service role key.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const graceHours = Math.max(0, Number(body.graceHours ?? 24) || 24)

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)

    const { data: expired, error: listError } = await supabase.rpc(
      'list_expired_stories_for_cleanup',
      { p_grace_hours: graceHours },
    )
    if (listError) {
      return jsonResponse({ ok: false, error: listError.message }, 500)
    }

    const rows = (expired ?? []) as Array<{ id: string; media_url: string | null }>
    if (!rows.length) {
      return jsonResponse({ ok: true, deleted: 0, mediaRemoved: 0 })
    }

    const paths = rows
      .map((row) => pathFromPublicUrl(row.media_url))
      .filter((path): path is string => Boolean(path))

    let mediaRemoved = 0
    if (paths.length) {
      // Storage remove accepts batches; chunk to stay under request limits.
      const chunkSize = 50
      for (let i = 0; i < paths.length; i += chunkSize) {
        const chunk = paths.slice(i, i + chunkSize)
        const { error: removeError } = await supabase.storage.from(BUCKET).remove(chunk)
        if (!removeError) mediaRemoved += chunk.length
      }
    }

    const ids = rows.map((row) => row.id)
    const { data: deletedCount, error: deleteError } = await supabase.rpc('delete_expired_stories', {
      p_ids: ids,
    })
    if (deleteError) {
      return jsonResponse(
        { ok: false, error: deleteError.message, mediaRemoved },
        500,
      )
    }

    return jsonResponse({
      ok: true,
      deleted: Number(deletedCount ?? ids.length),
      mediaRemoved,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cleanup failed'
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
