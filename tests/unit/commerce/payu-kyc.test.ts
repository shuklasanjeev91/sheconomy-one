import { describe, expect, it } from 'vitest'

import {
  buildBankUpdatePayload,
  buildCreateChildPayload,
  holderNameMatches,
  interpretGstRegistry,
  kycAllowsStorefront,
  panFromGstin,
  validatePayuKycInput,
  verifyGstin,
  verifyPanForEntity,
  type PayuKycInput,
} from '~/lib/payment/payu-kyc'

const valid: PayuKycInput = {
  legalName: 'Gauri Gupta',
  mobile: '+91 73100 00001',
  email: 'gauri@example.com',
  panNumber: 'ABQFA5416M',
  panName: 'Gauri Gupta',
  hasGst: true,
  gstNumber: '09ABQFA5416M1ZX',
  businessName: 'Gauri Gupta',
  businessEntityId: 3,
  monthlyExpectedVolume: 60000,
  bankAccountNumber: '663380994743',
  bankHolderName: 'Gauri Gupta',
  ifsc: 'icic0000031',
  panDocumentPath: 'user/shops/shop/kyc/pan.pdf',
  bankDocumentPath: 'user/shops/shop/kyc/bank.pdf',
  gstDocumentPath: 'user/shops/shop/kyc/gst.pdf',
  scheduleCDocumentPath: 'user/shops/shop/kyc/schedule_c.pdf',
}

describe('vendor PayU KYC', () => {
  it('accepts a complete application', () => {
    expect(validatePayuKycInput(valid)).toEqual({})
  })

  it('rejects a holder name that matches neither PAN nor business', () => {
    const errors = validatePayuKycInput({ ...valid, bankHolderName: 'Someone Else' })
    expect(errors.bankHolderName).toBeTruthy()
    expect(holderNameMatches('Gauri Gupta', 'Gauri Gupta', 'Other Shop')).toBe(true)
  })

  it('rejects a bad PAN, GSTIN, and IFSC', () => {
    const errors = validatePayuKycInput({
      ...valid,
      panNumber: 'ABC',
      gstNumber: '11',
      ifsc: 'ICICI0001',
    })
    expect(errors.panNumber).toBeTruthy()
    expect(errors.gstNumber).toBeTruthy()
    expect(errors.ifsc).toBeTruthy()
  })

  it('builds the create-child and bank payloads PayU expects', () => {
    const created = buildCreateChildPayload({
      shopId: 'shop-1',
      parentMid: '7210921',
      legalName: valid.legalName,
      email: valid.email,
      mobile: valid.mobile,
      panNumber: valid.panNumber,
      panName: valid.panName,
      businessName: valid.businessName,
      businessEntityId: 2,
      monthlyExpectedVolume: 60000,
      gstNumber: valid.gstNumber,
    })
    expect(created.product_account).toMatchObject({
      product: 'PayUbiz',
      merchant_type: 'aggregator',
      aggregator_parent_mid: '7210921',
      merchant_defined_identifier: 'shop-1',
      pancard_number: 'ABQFA5416M',
      mobile: '7310000001',
      business_category_id: 16,
      business_sub_category_id: 128,
      gst_number: '09ABQFA5416M1ZX',
    })
    expect(buildBankUpdatePayload(valid).product_account.bank_detail).toEqual({
      bank_account_number: '663380994743',
      holder_name: 'Gauri Gupta',
      ifsc_code: 'ICIC0000031',
    })
  })

  it('keeps a submitted shop off the storefront until PayU verified', () => {
    expect(kycAllowsStorefront(null)).toBe(true)
    expect(kycAllowsStorefront('submitted')).toBe(false)
    expect(kycAllowsStorefront('payu_pending')).toBe(false)
    expect(kycAllowsStorefront('payu_verified')).toBe(true)
  })

  it('requires a signed Schedule C upload', () => {
    const errors = validatePayuKycInput({ ...valid, scheduleCDocumentPath: '' })
    expect(errors.scheduleCDocumentPath).toBeTruthy()
  })

  it('reads the PAN from a GSTIN and rejects a mismatched or inactive registry result', () => {
    expect(verifyGstin('09ABQFA5416M1ZX')).toEqual({ ok: true, pan: 'ABQFA5416M' })
    expect(panFromGstin('09ABQFA5416M1ZX')).toBe('ABQFA5416M')
    expect(verifyGstin('09ABQFA5416M1ZY').ok).toBe(false)
    expect(verifyPanForEntity('ABQFA5416M', 3)).toBeNull()
    expect(verifyPanForEntity('ABQFA5416M', 2)).toBeTruthy()
    const active = interpretGstRegistry({
      data: { gstin: '09ABQFA5416M1ZX', lgnm: 'GAURI GUPTA', tradeNam: 'GAURI STORE', sts: 'Active', ctb: 'Partnership' },
    })
    expect(active.ok && active.result.legalName).toBe('GAURI GUPTA')
    expect(interpretGstRegistry({ data: { gstin: '09ABQFA5416M1ZX', lgnm: 'X', sts: 'Cancelled' } }).ok).toBe(false)
    expect(
      interpretGstRegistry(
        { data: { gstin: '09ABQFA5416M1ZX', lgnm: 'X', sts: 'Active' } },
        'DBZPK4951B',
      ).ok,
    ).toBe(false)
  })
})
