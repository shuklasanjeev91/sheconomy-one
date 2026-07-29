const DEFAULT_FROM = 'SHEconomy <noreply@sheconomy.com>'

export async function sendResendEmail(
  apiKey: string,
  payload: {
    to: string
    subject: string
    html: string
    from?: string
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
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || 'Resend error')
  }
}

export function appBaseUrl() {
  return (Deno.env.get('PUBLIC_APP_URL') ?? 'https://sheconomy.in').replace(/\/$/, '')
}
