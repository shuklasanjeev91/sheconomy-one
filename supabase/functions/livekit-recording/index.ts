import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { EgressClient, EncodedFileOutput, EncodedFileType } from 'npm:livekit-server-sdk@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('LIVEKIT_API_KEY')
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')
    const livekitUrl = Deno.env.get('LIVEKIT_URL')

    if (!apiKey || !apiSecret || !livekitUrl) {
      return new Response(JSON.stringify({ ok: false, error: 'LiveKit is not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const meetingId = String(body.meetingId ?? '')
    const roomName = String(body.roomName ?? '')
    const action = String(body.action ?? '') as 'start' | 'stop'
    const recordingId = body.recordingId ? String(body.recordingId) : undefined

    if (!meetingId || !roomName || !['start', 'stop'].includes(action)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid request.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, host_id, room_id')
      .eq('id', meetingId)
      .maybeSingle()

    if (meetingError || !meeting) {
      return new Response(JSON.stringify({ ok: false, error: 'Meeting not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (meeting.host_id !== authData.user.id) {
      return new Response(JSON.stringify({ ok: false, error: 'Only the host can control recording.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (meeting.room_id !== roomName) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid room.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'start') {
      const { data: row, error: insertError } = await serviceSupabase
        .from('meeting_recordings')
        .insert({
          meeting_id: meetingId,
          status: 'recording',
        })
        .select('id')
        .single()

      if (insertError || !row) {
        return new Response(JSON.stringify({ ok: false, error: 'Could not create recording record.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const s3Bucket = Deno.env.get('LIVEKIT_EGRESS_S3_BUCKET')
      const s3Region = Deno.env.get('LIVEKIT_EGRESS_S3_REGION')
      const s3AccessKey = Deno.env.get('LIVEKIT_EGRESS_S3_ACCESS_KEY')
      const s3Secret = Deno.env.get('LIVEKIT_EGRESS_S3_SECRET')

      if (!s3Bucket || !s3Region || !s3AccessKey || !s3Secret) {
        return new Response(
          JSON.stringify({
            ok: true,
            recordingId: row.id,
            warning: 'Recording started locally. Configure LIVEKIT_EGRESS_S3_* for cloud egress.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const egress = new EgressClient(livekitUrl, apiKey, apiSecret)
      const filepath = `meetings/${meetingId}/${row.id}.mp4`
      const output = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath,
        output: {
          case: 's3',
          value: {
            accessKey: s3AccessKey,
            secret: s3Secret,
            bucket: s3Bucket,
            region: s3Region,
          },
        },
      })

      const info = await egress.startRoomCompositeEgress(roomName, { file: output })

      await serviceSupabase
        .from('meeting_recordings')
        .update({ recording_sid: info.egressId })
        .eq('id', row.id)

      return new Response(
        JSON.stringify({ ok: true, recordingId: row.id, recordingSid: info.egressId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!recordingId) {
      return new Response(JSON.stringify({ ok: false, error: 'recordingId is required to stop.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: recording } = await serviceSupabase
      .from('meeting_recordings')
      .select('id, recording_sid')
      .eq('id', recordingId)
      .eq('meeting_id', meetingId)
      .maybeSingle()

    if (!recording) {
      return new Response(JSON.stringify({ ok: false, error: 'Recording not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (recording.recording_sid) {
      const egress = new EgressClient(livekitUrl, apiKey, apiSecret)
      await egress.stopEgress(recording.recording_sid)
    }

    await serviceSupabase
      .from('meeting_recordings')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId)

    return new Response(JSON.stringify({ ok: true, recordingId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('livekit-recording error:', error)
    return new Response(JSON.stringify({ ok: false, error: 'Recording control failed.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
