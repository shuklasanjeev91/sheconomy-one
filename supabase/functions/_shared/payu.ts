/**
 * PayU hash helpers for edge functions (mirrors commerce/lib/payu-hash.ts).
 */

export type PayUHashParams = {
  key: string
  txnid: string
  amount: string
  productinfo: string
  firstname: string
  email: string
  udf1?: string
  udf2?: string
  udf3?: string
  udf4?: string
  udf5?: string
}

export function buildPayUHashString(params: PayUHashParams, salt: string): string {
  return [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    params.udf1 ?? '',
    params.udf2 ?? '',
    params.udf3 ?? '',
    params.udf4 ?? '',
    params.udf5 ?? '',
    '',
    '',
    '',
    '',
    '',
    salt,
  ].join('|')
}

export function buildPayUReverseHashString(
  params: PayUHashParams & { status: string },
  salt: string,
): string {
  return [
    salt,
    params.status,
    '',
    '',
    '',
    '',
    '',
    params.udf5 ?? '',
    params.udf4 ?? '',
    params.udf3 ?? '',
    params.udf2 ?? '',
    params.udf1 ?? '',
    params.email,
    params.firstname,
    params.productinfo,
    params.amount,
    params.txnid,
    params.key,
  ].join('|')
}

export async function sha512Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-512', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function payURequestHash(params: PayUHashParams, salt: string): Promise<string> {
  return sha512Hex(buildPayUHashString(params, salt))
}

export async function payUResponseHash(
  params: PayUHashParams & { status: string },
  salt: string,
): Promise<string> {
  return sha512Hex(buildPayUReverseHashString(params, salt))
}
