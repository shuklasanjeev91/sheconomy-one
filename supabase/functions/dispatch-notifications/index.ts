import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BRAND_NAME = 'SHEconomy'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

type DeliveryChannel = 'email' | 'push' | 'whatsapp' | 'sms' | 'in_app'

type NotificationRow = {
  id: string
  recipient_id: string
  title: string
  message: string
  action_url: string | null
  channels: string[] | null
  delivery_status: Record<string, { status?: string; at?: string; error?: string }> | null
  data: Record<string, unknown> | null
  template_id: string | null
  type?: string | null
  priority?: number | null
}

type TemplateRow = {
  email_subject_template: string | null
  email_body_template: string | null
  push_title_template: string | null
  push_body_template: string | null
  whatsapp_template: string | null
  sms_template: string | null
}

function substitute(template: string | null | undefined, vars: Record<string, unknown>) {
  if (!template) return ''
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = vars[key]
    return value == null ? '' : String(value)
  })
}

function channelDone(
  status: NotificationRow['delivery_status'],
  channel: DeliveryChannel,
) {
  return status?.[channel]?.status === 'sent' || status?.[channel]?.status === 'skipped'
}

async function sendResendEmail(apiKey: string, payload: {
  to: string
  subject: string
  html: string
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${BRAND_NAME} <noreply@sheconomy.com>`,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  })
  if (!response.ok) {
    throw new Error((await response.text()) || 'Resend error')
  }
}

async function sendOneSignalPush(options: {
  appId: string
  apiKey: string
  /** OneSignal subscription / player ids from user_push_devices. */
  playerIds?: string[]
  /** Auth user ids passed to OneSignal.login() on clients. */
  externalIds?: string[]
  title: string
  body: string
  url?: string | null
  /** Extra data payload (call ids, kind, etc.). */
  data?: Record<string, unknown>
  /** High-priority ringing push for incoming calls. */
  isIncomingCall?: boolean
}) {
  const playerIds = (options.playerIds ?? []).filter(Boolean)
  const externalIds = (options.externalIds ?? []).filter(Boolean)
  if (!playerIds.length && !externalIds.length) return

  const data: Record<string, unknown> = {
    ...(options.data ?? {}),
  }
  if (options.url) {
    data.action_url = options.url
    data.url = options.url
  }
  if (options.isIncomingCall) {
    data.notification_kind = 'incoming_call'
  }

  const base: Record<string, unknown> = {
    app_id: options.appId,
    headings: { en: options.title },
    contents: { en: options.body },
    target_channel: 'push',
    data: Object.keys(data).length ? data : undefined,
    web_url: options.url ?? undefined,
    app_url: options.url ?? undefined,
    url: options.url ?? undefined,
  }

  if (options.isIncomingCall) {
    // Wake locked devices and play a call-like alert when the app is not open.
    // Use OS defaults so delivery does not fail when custom sound files / channels are missing.
    Object.assign(base, {
      priority: 10,
      ttl: 55,
      ios_sound: 'default',
      ios_interruption_level: 'time_sensitive',
      ios_relevance_score: 1,
      android_visibility: 1,
      android_group: 'incoming_calls',
      android_accent_color: 'FFD81B60',
      collapse_id: typeof data.call_id === 'string' ? `call:${data.call_id}` : 'incoming_call',
      content_available: true,
      mutable_content: true,
    })
  }

  // OneSignal allows only one targeting parameter per request.
  // Prefer external_id (set via OneSignal.login on web/native); fall back to
  // stored subscription ids when alias targeting is rejected.
  const targetingAttempts: Record<string, unknown>[] = []
  if (externalIds.length) {
    targetingAttempts.push({ include_aliases: { external_id: externalIds } })
  }
  if (playerIds.length) {
    targetingAttempts.push({ include_subscription_ids: playerIds })
  }

  let lastError: Error | null = null
  for (const targeting of targetingAttempts) {
    const payload = { ...base, ...targeting }
    for (const authHeader of [`Key ${options.apiKey}`, `Basic ${options.apiKey}`]) {
      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      if (response.ok) return
      lastError = new Error((await response.text()) || 'OneSignal error')
    }
  }
  if (lastError) throw lastError
}

async function sendTwilioMessage(options: {
  accountSid: string
  authToken: string
  from: string
  to: string
  body: string
  channel: 'whatsapp' | 'sms'
}) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${options.accountSid}/Messages.json`
  const isWhatsApp = options.channel === 'whatsapp'
  const params = new URLSearchParams({
    From: isWhatsApp
      ? options.from.startsWith('whatsapp:')
        ? options.from
        : `whatsapp:${options.from}`
      : options.from.replace(/^whatsapp:/, ''),
    To: isWhatsApp
      ? options.to.startsWith('whatsapp:')
        ? options.to
        : `whatsapp:${options.to}`
      : options.to.replace(/^whatsapp:/, ''),
    Body: options.body,
  })
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${options.accountSid}:${options.authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  if (!response.ok) {
    throw new Error((await response.text()) || `Twilio ${options.channel} error`)
  }
}

function markChannel(
  current: NotificationRow['delivery_status'],
  channel: DeliveryChannel,
  status: 'sent' | 'failed' | 'skipped',
  error?: string,
) {
  return {
    ...(current ?? {}),
    [channel]: {
      status,
      at: new Date().toISOString(),
      ...(error ? { error } : {}),
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get('NOTIFICATION_CRON_SECRET')
    const authHeader = req.headers.get('Authorization') ?? ''
    const cronHeader = req.headers.get('x-cron-secret') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const isService =
      authHeader === `Bearer ${serviceKey}` ||
      (cronSecret != null && cronSecret.length > 0 && cronHeader === cronSecret)

    if (!isService) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey,
    )

    const body = (await req.json().catch(() => ({}))) as {
      limit?: number
      notification_id?: string
    }
    const limit = Math.min(Math.max(body.limit ?? 40, 1), 100)

    // Prefer explicit queue rows, then undelivered notifications.
    const { data: queueRows } = await supabase
      .from('notification_event_queue')
      .select('id, payload')
      .eq('event_key', 'dispatch_notification')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(limit)

    const queuedIds = (queueRows ?? [])
      .map((row) => (row.payload as { notification_id?: string } | null)?.notification_id)
      .filter((id): id is string => !!id)

    let notificationQuery = supabase
      .from('notifications')
      .select('id, recipient_id, title, message, action_url, channels, delivery_status, data, template_id, type, priority')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (body.notification_id) {
      notificationQuery = notificationQuery.eq('id', body.notification_id)
    } else if (queuedIds.length) {
      notificationQuery = notificationQuery.in('id', queuedIds)
    } else {
      notificationQuery = notificationQuery.is('delivered_at', null)
    }

    const { data: notifications, error } = await notificationQuery
    if (error) throw error

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID')
    const oneSignalKey = Deno.env.get('ONESIGNAL_REST_API_KEY')
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const twilioSmsFrom = Deno.env.get('TWILIO_PHONE_NUMBER')
    // Prefer dedicated WhatsApp sender; fall back to the SMS phone number.
    const twilioWhatsAppFrom =
      Deno.env.get('TWILIO_WHATSAPP_FROM') ?? twilioSmsFrom

    let dispatched = 0

    for (const notification of (notifications ?? []) as NotificationRow[]) {
      const channels = (notification.channels ?? []).map((c) => c.toLowerCase()) as DeliveryChannel[]
      let delivery = notification.delivery_status ?? {}
      const vars = {
        ...(notification.data ?? {}),
        title: notification.title,
        message: notification.message,
        action_url: notification.action_url ?? '',
      }

      let template: TemplateRow | null = null
      if (notification.template_id) {
        const { data } = await supabase
          .from('notification_templates')
          .select(
            'email_subject_template, email_body_template, push_title_template, push_body_template, whatsapp_template, sms_template',
          )
          .eq('id', notification.template_id)
          .maybeSingle()
        template = data
      }

      const { data: authUser } = await supabase.auth.admin.getUserById(notification.recipient_id)
      const email = authUser.user?.email ?? null
      const phone =
        (authUser.user?.phone as string | undefined) ||
        ((authUser.user?.user_metadata as { phone?: string } | undefined)?.phone ?? null)

      // in_app is already persisted in notifications table
      if (channels.includes('in_app') && !channelDone(delivery, 'in_app')) {
        delivery = markChannel(delivery, 'in_app', 'sent')
      }

      if (channels.includes('email') && !channelDone(delivery, 'email')) {
        if (!resendKey || !email) {
          delivery = markChannel(
            delivery,
            'email',
            resendKey ? 'skipped' : 'failed',
            resendKey ? 'No recipient email' : 'RESEND_API_KEY not configured',
          )
        } else {
          try {
            const subject =
              substitute(template?.email_subject_template, vars) || notification.title
            const html =
              substitute(template?.email_body_template, vars) ||
              `<p>${notification.message}</p>${
                notification.action_url
                  ? `<p><a href="${notification.action_url}">Open in ${BRAND_NAME}</a></p>`
                  : ''
              }`
            await sendResendEmail(resendKey, { to: email, subject, html })
            delivery = markChannel(delivery, 'email', 'sent')
          } catch (err) {
            delivery = markChannel(
              delivery,
              'email',
              'failed',
              err instanceof Error ? err.message : 'email failed',
            )
          }
        }
      }

      if (channels.includes('push') && !channelDone(delivery, 'push')) {
        if (!oneSignalAppId || !oneSignalKey) {
          delivery = markChannel(delivery, 'push', 'failed', 'OneSignal not configured')
        } else {
          const { data: devices } = await supabase
            .from('user_push_devices')
            .select('player_id')
            .eq('user_id', notification.recipient_id)
            .eq('enabled', true)
          const playerIds = (devices ?? []).map((d) => d.player_id).filter(Boolean)
          try {
            const isIncomingCall =
              notification.type === 'incoming_call' ||
              vars.notification_kind === 'incoming_call' ||
              (typeof notification.action_url === 'string' &&
                notification.action_url.includes('ring=1'))
            // Always target external_id (OneSignal.login(userId) on web/native).
            // Player/subscription ids are optional extras when registration succeeded.
            await sendOneSignalPush({
              appId: oneSignalAppId,
              apiKey: oneSignalKey,
              playerIds,
              externalIds: [notification.recipient_id],
              title:
                substitute(template?.push_title_template, vars) || notification.title,
              body:
                substitute(template?.push_body_template, vars) || notification.message,
              url: notification.action_url,
              data: vars,
              isIncomingCall,
            })
            delivery = markChannel(delivery, 'push', 'sent')
          } catch (err) {
            delivery = markChannel(
              delivery,
              'push',
              'failed',
              err instanceof Error ? err.message : 'push failed',
            )
          }
        }
      }

      if (channels.includes('whatsapp') && !channelDone(delivery, 'whatsapp')) {
        if (!twilioSid || !twilioToken || !twilioWhatsAppFrom || !phone) {
          delivery = markChannel(
            delivery,
            'whatsapp',
            phone ? 'failed' : 'skipped',
            phone ? 'Twilio WhatsApp not configured' : 'No phone on profile',
          )
        } else {
          try {
            await sendTwilioMessage({
              accountSid: twilioSid,
              authToken: twilioToken,
              from: twilioWhatsAppFrom,
              to: phone,
              channel: 'whatsapp',
              body:
                substitute(template?.whatsapp_template, vars) ||
                `${notification.title}\n${notification.message}${
                  notification.action_url ? `\n${notification.action_url}` : ''
                }`,
            })
            delivery = markChannel(delivery, 'whatsapp', 'sent')
          } catch (err) {
            delivery = markChannel(
              delivery,
              'whatsapp',
              'failed',
              err instanceof Error ? err.message : 'whatsapp failed',
            )
          }
        }
      }

      if (channels.includes('sms') && !channelDone(delivery, 'sms')) {
        if (!twilioSid || !twilioToken || !twilioSmsFrom || !phone) {
          delivery = markChannel(
            delivery,
            'sms',
            phone ? 'failed' : 'skipped',
            phone ? 'Twilio SMS not configured' : 'No phone on profile',
          )
        } else {
          try {
            await sendTwilioMessage({
              accountSid: twilioSid,
              authToken: twilioToken,
              from: twilioSmsFrom,
              to: phone,
              channel: 'sms',
              body:
                substitute(template?.sms_template, vars) ||
                `${notification.title}: ${notification.message}${
                  notification.action_url ? ` ${notification.action_url}` : ''
                }`,
            })
            delivery = markChannel(delivery, 'sms', 'sent')
          } catch (err) {
            delivery = markChannel(
              delivery,
              'sms',
              'failed',
              err instanceof Error ? err.message : 'sms failed',
            )
          }
        }
      }

      const outbound = channels.filter((c) => c !== 'in_app')
      const allDone =
        outbound.length === 0 ||
        outbound.every((channel) => {
          const state = delivery[channel]?.status
          return state === 'sent' || state === 'skipped' || state === 'failed'
        })

      await supabase
        .from('notifications')
        .update({
          delivery_status: delivery,
          delivered_at: allDone ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.id)

      for (const channel of channels) {
        const state = delivery[channel]?.status
        if (!state) continue
        await supabase.from('notification_events').insert({
          notification_id: notification.id,
          event_type: 'dispatch',
          channel,
          status: state === 'sent' ? 'success' : state,
          error_message: delivery[channel]?.error ?? null,
        })
      }

      dispatched += 1
    }

    if (queueRows?.length) {
      const ids = queueRows.map((row) => row.id)
      await supabase
        .from('notification_event_queue')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .in('id', ids)
    }

    return new Response(JSON.stringify({ ok: true, dispatched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Dispatch failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
