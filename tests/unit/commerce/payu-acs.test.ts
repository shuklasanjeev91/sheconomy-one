import { describe, expect, it } from 'vitest'

/**
 * Mirrors supabase/functions/_shared/payu.ts normalizePayuAcsHtml —
 * PayU NB S2S returns Base64-encoded acsTemplate.
 */
function normalizePayuAcsHtml(raw: string): string {
  const value = String(raw ?? '').trim()
  if (!value) return value
  if (/^\s*</.test(value) || /<!DOCTYPE|<html|<form/i.test(value)) {
    return value
  }
  try {
    const decoded = atob(value.replace(/\s+/g, ''))
    if (/^\s*</.test(decoded) || /<!DOCTYPE|<html|<form/i.test(decoded)) {
      return decoded
    }
  } catch {
    // not base64
  }
  return value
}

describe('normalizePayuAcsHtml', () => {
  it('passes through raw HTML', () => {
    const html = '<html><form action="https://bank.example/acs"></form></html>'
    expect(normalizePayuAcsHtml(html)).toBe(html)
  })

  it('decodes Base64 acsTemplate from PayU NB S2S', () => {
    const html = '<html><body><form name="payment_post"></form></body></html>'
    const encoded = btoa(html)
    expect(normalizePayuAcsHtml(encoded)).toBe(html)
  })

  it('returns non-HTML opaque strings unchanged', () => {
    expect(normalizePayuAcsHtml('not-base64-or-html')).toBe('not-base64-or-html')
  })
})
