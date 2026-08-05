import { supabase } from '~/lib/supabase/client'
import { savePayuBridgeSession } from '~/commerce/lib/payu-bridge'

export type ShepayPayuCreateResult = {
  checkout_url: string
  action_url: string
  fields: Record<string, string>
  txnid: string
  payment_step_id: string
}

/** Create a PayU SHEPay session for a checkout payment step (collection=shepay). */
export async function createShepayPayuSession(
  paymentStepId: string,
  options?: { paymentMethodId?: string | null; payuPg?: string | null },
): Promise<{
  data: ShepayPayuCreateResult | null
  error: string | null
}> {
  const { data, error } = await supabase.functions.invoke('shepay-payu-create', {
    body: {
      payment_step_id: paymentStepId,
      payment_method_id: options?.paymentMethodId ?? null,
      pg: options?.payuPg ?? null,
    },
  })

  if (error) {
    return { data: null, error: error.message }
  }

  const payload = data as ShepayPayuCreateResult & { error?: string }
  if (payload?.error) return { data: null, error: payload.error }
  if (!payload?.checkout_url) return { data: null, error: 'SHEPay did not return a checkout URL' }

  if (payload.action_url && payload.fields) {
    savePayuBridgeSession(payload.action_url, payload.fields)
  }

  return { data: payload, error: null }
}

/** For each SHEPay step without a URL, create a PayU session and return the first checkout URL. */
export async function ensureShepayCheckoutUrl(
  paymentSteps: Array<{ id: string; collection?: string; checkoutUrl?: string | null }>,
  options?: { paymentMethodId?: string | null; payuPg?: string | null },
): Promise<{ checkoutUrl: string | null; error: string | null }> {
  const shepaySteps = paymentSteps.filter((step) => step.collection === 'shepay')

  const needingSession = shepaySteps.filter((step) => !step.checkoutUrl)
  if (!needingSession.length) {
    return {
      checkoutUrl:
        shepaySteps.find((s) => s.checkoutUrl)?.checkoutUrl ??
        paymentSteps.find((s) => s.checkoutUrl)?.checkoutUrl ??
        null,
      error: null,
    }
  }

  let firstUrl: string | null = null
  for (const step of needingSession) {
    const result = await createShepayPayuSession(step.id, options)
    if (result.error) return { checkoutUrl: firstUrl, error: result.error }
    if (!firstUrl && result.data?.checkout_url) firstUrl = result.data.checkout_url
  }

  return { checkoutUrl: firstUrl, error: null }
}
