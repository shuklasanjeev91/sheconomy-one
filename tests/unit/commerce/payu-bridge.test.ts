import { describe, expect, it } from 'vitest'

import {
  buildPayuAutoSubmitHtml,
  consumePayuBridgeSession,
  isPayuReturnUrl,
  parsePayuBridgeParams,
  payuReturnHref,
  payuReturnStatusFromUrl,
  savePayuBridgeSession,
} from '~/commerce/lib/payu-bridge'

describe('payu-bridge helpers', () => {
  it('builds an auto-submitting POST form', () => {
    const html = buildPayuAutoSubmitHtml('https://test.payu.in/_payment', {
      key: 'merchant',
      amount: '10.00',
      productinfo: 'Order <1> & "test"',
    })
    expect(html).toContain('action="https://test.payu.in/_payment"')
    expect(html).toContain('name="key"')
    expect(html).toContain('value="merchant"')
    expect(html).toContain('value="Order &lt;1&gt; &amp; &quot;test&quot;"')
    expect(html).toContain("document.getElementById('payu').submit()")
  })

  it('detects PayU return URLs', () => {
    expect(isPayuReturnUrl('/orders/payu-return?status=success')).toBe(true)
    expect(isPayuReturnUrl('https://sheconomy.in/orders/payu-return?status=failure')).toBe(true)
    expect(isPayuReturnUrl('/orders/payu?action=x')).toBe(false)
  })

  it('parses return status and href', () => {
    expect(payuReturnStatusFromUrl('/orders/payu-return?status=success')).toBe('success')
    expect(payuReturnStatusFromUrl('https://sheconomy.in/orders/payu-return?status=failure')).toBe(
      'failure',
    )
    expect(payuReturnHref('success')).toBe('/orders/payu-return?status=success')
  })

  it('parses bridge params and supports in-memory session handoff', () => {
    const parsed = parsePayuBridgeParams(
      'https://test.payu.in/_payment',
      JSON.stringify({ key: 'm', amount: '1.00' }),
    )
    expect(parsed.error).toBeNull()
    expect(parsed.fields?.key).toBe('m')

    savePayuBridgeSession(parsed.action, parsed.fields!)
    const session = consumePayuBridgeSession()
    expect(session?.action).toBe('https://test.payu.in/_payment')
    expect(consumePayuBridgeSession()).toBeNull()
  })
})
