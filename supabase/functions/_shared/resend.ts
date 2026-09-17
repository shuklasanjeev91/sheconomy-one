import { resolvePublicAppOrigin } from './app-url.ts'

const DEFAULT_FROM = 'SHEconomy <noreply@sheconomy.com>'

export async function sendResendEmail(
  apiKey: string,
  payload: {
    to: string
    subject: string
    html: string
    text?: string
    from?: string
    attachments?: { filename: string; content: string }[]
  },
) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: payload.from ?? DEFAULT_FROM,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
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
