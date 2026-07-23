/**
 * Shiprocket API client — used from edge functions (server-side only).
 */

const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external'

export type ShiprocketLoginResult = {
  token: string
  id?: number
  email?: string
  company_id?: number
  first_name?: string
  last_name?: string
}

async function shiprocketRequest<T>(
  url: string,
  token: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = (await response.json()) as T & { message?: string; error?: string }
  if (!response.ok) {
    throw new Error(data.message || data.error || `Shiprocket request failed (${response.status})`)
  }
  return data
}

export async function shiprocketLogin(email: string, password: string): Promise<ShiprocketLoginResult> {
  const response = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const data = (await response.json()) as ShiprocketLoginResult & { message?: string; error?: string }
  if (!response.ok || !data.token) {
    throw new Error(data.message || data.error || 'Shiprocket authentication failed.')
  }
  return data
}

export async function shiprocketVerifyToken(token: string): Promise<boolean> {
  try {
    await shiprocketRequest(`${SHIPROCKET_BASE_URL}/settings/company/profile`, token)
    return true
  } catch {
    return false
  }
}

export async function shiprocketGetPickupLocations(token: string) {
  const data = await shiprocketRequest<{ data?: { shipping_address?: Array<{ id?: number }> } }>(
    `${SHIPROCKET_BASE_URL}/settings/company/pickup`,
    token,
  )
  return data.data?.shipping_address ?? []
}

export async function shiprocketGetChannels(token: string) {
  const data = await shiprocketRequest<{ data?: Array<{ id?: number }> }>(
    `${SHIPROCKET_BASE_URL}/channels`,
    token,
  )
  return data.data ?? []
}
