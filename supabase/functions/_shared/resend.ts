import { resolvePublicAppOrigin } from './app-url.ts'
import { wrapEmailHtml } from './email-layout.ts'

// Resend verified domain is sheconomy.in (sheconomy.com is not verified).
const DEFAULT_FROM = 'SHEconomy <noreply@sheconomy.in>'

export async function sendResendEmail(
  apiKey: string,
  payload: {
    to: string | string[]
    subject: string
    html: string
    text?: string
    from?: string
    replyTo?: string | string[]
    cc?: string | string[]
    attachments?: { filename: string; content: string }[]
    /** Skip branded chrome (rare). Full HTML docs are never double-wrapped. */
    skipLayout?: boolean
  },
) {
  const to = Array.isArray(payload.to) ? payload.to : [payload.to]
  const replyTo = payload.replyTo
    ? Array.isArray(payload.replyTo)
      ? payload.replyTo
      : [payload.replyTo]
    : undefined
  const cc = payload.cc
    ? Array.isArray(payload.cc)
      ? payload.cc
      : [payload.cc]
    : undefined
  const html = wrapEmailHtml(payload.html, {
    skipLayout: payload.skipLayout,
    preheader: payload.subject,
  })
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: payload.from ?? DEFAULT_FROM,
      to,
      ...(replyTo?.length ? { reply_to: replyTo } : {}),
      ...(cc?.length ? { cc } : {}),
      subject: payload.subject,
      html,
      text: payload.text,
      attachments: payload.attachments,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Resend error')
  }
}

export function appBaseUrl() {
  return resolvePublicAppOrigin()
}
