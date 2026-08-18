// Twilio REST helpers shared across edge functions (notifications, checkout OTP).

export type TwilioChannel = 'whatsapp' | 'sms'

export type TwilioCredentials = {
  accountSid: string
  authToken: string
  smsFrom: string | null
  whatsAppFrom: string | null
}

/** Read Twilio config from env. Returns null when the core creds are missing. */
export function resolveTwilioCredentials(): TwilioCredentials | null {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  if (!accountSid || !authToken) return null

  const smsFrom = Deno.env.get('TWILIO_PHONE_NUMBER') ?? null
  return {
    accountSid,
    authToken,
    smsFrom,
    // Prefer a dedicated WhatsApp sender; fall back to the SMS number.
    whatsAppFrom: Deno.env.get('TWILIO_WHATSAPP_FROM') ?? smsFrom,
  }
}

export async function sendTwilioMessage(options: {
  accountSid: string
  authToken: string
  from: string
  to: string
  body: string
  channel: TwilioChannel
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
