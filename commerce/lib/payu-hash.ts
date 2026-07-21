/**
 * PayU Merchant Hosted Checkout hash helpers (SHA-512).
 * Sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
 * @see https://docs.payu.in/docs/custom-checkout-merchant-hosted
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
  const udf1 = params.udf1 ?? ''
  const udf2 = params.udf2 ?? ''
  const udf3 = params.udf3 ?? ''
  const udf4 = params.udf4 ?? ''
  const udf5 = params.udf5 ?? ''
  return [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    '',
    '',
    '',
    '',
    '',
    salt,
  ].join('|')
}

/** Reverse hash for PayU response verification: salt|status||||||udf5|...|email|firstname|productinfo|amount|txnid|key */
export function buildPayUReverseHashString(
  params: PayUHashParams & { status: string },
  salt: string,
): string {
  const udf1 = params.udf1 ?? ''
  const udf2 = params.udf2 ?? ''
  const udf3 = params.udf3 ?? ''
  const udf4 = params.udf4 ?? ''
  const udf5 = params.udf5 ?? ''
  return [
    salt,
    params.status,
    '',
    '',
    '',
    '',
    '',
    udf5,
    udf4,
    udf3,
    udf2,
    udf1,
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

export function formatPayUAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2)
}
