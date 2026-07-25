import { supabase } from '~/lib/supabase/client'

export type RazorpayDirectCreateResult = {
  checkout_url: string
  payment_link_id: string
  payment_step_id: string
  key_id: string
}

/** Create a Razorpay Payment Link for a direct-collection checkout step. */
export async function createRazorpayDirectSession(paymentStepId: string): Promise<{
  data: RazorpayDirectCreateResult | null
  error: string | null
}> {
  const { data, error } = await supabase.functions.invoke('razorpay-direct-create', {
    body: { payment_step_id: paymentStepId },
  })

  if (error) {
    return { data: null, error: error.message }
  }

  const payload = data as RazorpayDirectCreateResult & { error?: string }
  if (payload?.error) return { data: null, error: payload.error }
  if (!payload?.checkout_url) {
    return { data: null, error: 'Razorpay did not return a checkout URL' }
  }

  return { data: payload, error: null }
}

type DirectCheckoutStep = {
  id: string
  collection?: string
  provider?: string | null
  checkoutUrl?: string | null
}

/**
 * For each direct seller step without a URL, create a provider session.
 * Currently supports Razorpay (`provider === 'razorpay'`).
 */
export async function ensureDirectCheckoutUrl(
  paymentSteps: DirectCheckoutStep[],
): Promise<{ checkoutUrl: string | null; error: string | null }> {
  const directSteps = paymentSteps.filter((step) => step.collection === 'direct')

  const needingSession = directSteps.filter((step) => !step.checkoutUrl)
  if (!needingSession.length) {
    return {
      checkoutUrl:
        directSteps.find((step) => step.checkoutUrl)?.checkoutUrl ??
        paymentSteps.find((step) => step.checkoutUrl)?.checkoutUrl ??
        null,
      error: null,
    }
  }

  let firstUrl: string | null = null
  for (const step of needingSession) {
    const provider = (step.provider ?? '').toLowerCase()
    if (provider !== 'razorpay') {
      return {
        checkoutUrl: firstUrl,
        error: `Direct checkout for ${provider || 'unknown'} is not supported yet.`,
      }
    }

    const result = await createRazorpayDirectSession(step.id)
    if (result.error) return { checkoutUrl: firstUrl, error: result.error }
    if (!firstUrl && result.data?.checkout_url) firstUrl = result.data.checkout_url
  }

  return { checkoutUrl: firstUrl, error: null }
}
