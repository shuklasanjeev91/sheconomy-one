import { describe, expect, it } from 'vitest'

import {
  buildBankUpdatePayload,
  buildCreateChildPayload,
  entitiesInGroup,
  entityGroupForId,
  entityShortLabel,
  getEntityKycRequirements,
  holderNameMatches,
  inferEntityFromGstConstitution,
  inferEntityFromPan,
  interpretGstRegistry,
  kycAllowsStorefront,
  panFromGstin,
  pickEntityInGroup,
  validatePayuKycInput,
  verifyGstin,
  verifyKycCin,
  verifyKycLlpin,
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
  cin: '',
  llpin: '',
  registrationNumber: '',
  panDocumentPath: 'user/shops/shop/kyc/pan.pdf',
  bankDocumentPath: 'user/shops/shop/kyc/bank.pdf',
  gstDocumentPath: 'user/shops/shop/kyc/gst.pdf',
  scheduleCDocumentPath: 'user/shops/shop/kyc/schedule_c.pdf',
  incorporationDocumentPath: '',
  ownershipDocumentPath: 'user/shops/shop/kyc/ownership.pdf',
  idFrontDocumentPath: '',
  idBackDocumentPath: '',
}

describe('vendor PayU KYC', () => {
  it('accepts a complete partnership application', () => {
    expect(validatePayuKycInput(valid)).toEqual({})
  })

  it('requires partnership deed for partnership entities', () => {
    const errors = validatePayuKycInput({ ...valid, ownershipDocumentPath: '' })
    expect(errors.ownershipDocumentPath).toBeTruthy()
  })

  it('requires CIN and Certificate of Incorporation for private limited and corporation', () => {
    const company: PayuKycInput = {
      ...valid,
      panNumber: 'ABCCA5416M',
      gstNumber: '',
      hasGst: false,
      gstDocumentPath: '',
      businessEntityId: 4,
      ownershipDocumentPath: '',
      cin: 'U12345MH2020PTC123456',
      incorporationDocumentPath: 'user/shops/shop/kyc/coi.pdf',
    }
    expect(validatePayuKycInput(company)).toEqual({})
    expect(validatePayuKycInput({ ...company, cin: '' }).cin).toBeTruthy()
    expect(
      validatePayuKycInput({ ...company, incorporationDocumentPath: '' }).incorporationDocumentPath,
    ).toBeTruthy()

    const corp: PayuKycInput = {
      ...company,
      businessEntityId: 5,
      cin: 'L12345MH2020PLC123456',
    }
    expect(validatePayuKycInput(corp)).toEqual({})
    expect(verifyPanForEntity('ABCCA5416M', 5)).toBeNull()
    expect(getEntityKycRequirements(5).legalNameLabel).toContain('Corporation')
  })

  it('supports HUF and NGO entity packs', () => {
    const huf: PayuKycInput = {
      ...valid,
      panNumber: 'ABCHA5416M',
      businessEntityId: 10,
      hasGst: false,
      gstDocumentPath: '',
      ownershipDocumentPath: '',
    }
    expect(validatePayuKycInput(huf)).toEqual({})
    expect(verifyPanForEntity('ABCHA5416M', 10)).toBeNull()

    const ngo: PayuKycInput = {
      ...valid,
      panNumber: 'ABCTA5416M',
      businessEntityId: 15,
      hasGst: false,
      gstDocumentPath: '',
      registrationNumber: 'NGO/2020/12',
      ownershipDocumentPath: 'user/shops/shop/kyc/ngo.pdf',
    }
    expect(validatePayuKycInput(ngo)).toEqual({})
  })

  it('requires LLPIN and LLP agreement for LLP', () => {
    const llp: PayuKycInput = {
      ...valid,
      businessEntityId: 6,
      ownershipDocumentPath: 'user/shops/shop/kyc/llp.pdf',
      llpin: 'AAA-1234',
      hasGst: false,
      gstDocumentPath: '',
    }
    expect(validatePayuKycInput(llp)).toEqual({})
    expect(validatePayuKycInput({ ...llp, llpin: 'bad' }).llpin).toBeTruthy()
  })

  it('requires registration number and ownership doc for trust and society', () => {
    const trust: PayuKycInput = {
      ...valid,
      panNumber: 'ABCTA5416M',
      businessEntityId: 7,
      hasGst: false,
      gstDocumentPath: '',
      registrationNumber: 'TRUST/2020/12',
      ownershipDocumentPath: 'user/shops/shop/kyc/trust.pdf',
    }
    expect(validatePayuKycInput(trust)).toEqual({})
    expect(validatePayuKycInput({ ...trust, registrationNumber: '' }).registrationNumber).toBeTruthy()

    const society: PayuKycInput = {
      ...trust,
      panNumber: 'ABCAA5416M',
      businessEntityId: 8,
      ownershipDocumentPath: 'user/shops/shop/kyc/society.pdf',
    }
    expect(validatePayuKycInput(society)).toEqual({})
  })

  it('does not require admin docs for individual or sole prop', () => {
    const sole: PayuKycInput = {
      ...valid,
      panNumber: 'ABCPA5416M',
      businessEntityId: 2,
      hasGst: false,
      gstDocumentPath: '',
      ownershipDocumentPath: '',
    }
    expect(validatePayuKycInput(sole)).toEqual({})
    expect(getEntityKycRequirements(2).optionalAdminDocs[0]?.kind).toBe('id_front')
    expect(getEntityKycRequirements(14).requiredAdminDocs).toEqual([])
  })

  it('rejects a holder name that matches neither PAN nor trade name', () => {
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
    expect(kycAllowsStorefront(null)).toBe(false)
    expect(kycAllowsStorefront(undefined)).toBe(false)
    expect(kycAllowsStorefront('submitted')).toBe(false)
    expect(kycAllowsStorefront('payu_pending')).toBe(false)
    expect(kycAllowsStorefront('payu_verified')).toBe(true)
  })

  it('requires a signed Schedule C upload', () => {
    const errors = validatePayuKycInput({ ...valid, scheduleCDocumentPath: '' })
    expect(errors.scheduleCDocumentPath).toBeTruthy()
  })

  it('validates CIN and LLPIN formats', () => {
    expect(verifyKycCin('U12345MH2020PTC123456').ok).toBe(true)
    expect(verifyKycCin('bad').ok).toBe(false)
    expect(verifyKycLlpin('AAA1234').ok).toBe(true)
    expect(verifyKycLlpin('AAA-1234').ok).toBe(true)
    expect(verifyKycLlpin('xx').ok).toBe(false)
  })

  it('organises entities into structure → exact-type buckets', () => {
    expect(entityGroupForId(2)).toBe('person')
    expect(entityGroupForId(6)).toBe('firm')
    expect(entityShortLabel(5)).toBe('Public Ltd')
    expect(entityShortLabel(1)).toBe('AOP')
    expect(entitiesInGroup('company').map((row) => row.id)).toEqual([4, 5, 16])
    expect(pickEntityInGroup('company', 5)).toBe(5)
    expect(pickEntityInGroup('company', 2)).toBe(4)
    expect(pickEntityInGroup('nonprofit')).toBe(1)
  })

  it('infers business type from PAN letter and GST constitution', () => {
    expect(inferEntityFromPan('ABCPK1234F')).toBe(2)
    expect(inferEntityFromPan('ABCPK1234F', 14)).toBe(14)
    expect(inferEntityFromPan('ABCCE1234F', 2)).toBe(4)
    expect(inferEntityFromGstConstitution('Private Limited Company')).toBe(4)
    expect(inferEntityFromGstConstitution('Limited Liability Partnership')).toBe(6)
    expect(inferEntityFromGstConstitution('Proprietorship')).toBe(2)
    expect(inferEntityFromGstConstitution('Hindu Undivided Family')).toBe(10)
    expect(inferEntityFromGstConstitution('Mystery Org')).toBeNull()
  })

  it('reads the PAN from a GSTIN and rejects a mismatched or inactive registry result', () => {
    expect(verifyGstin('09ABQFA5416M1ZX')).toEqual({ ok: true, pan: 'ABQFA5416M' })
    expect(panFromGstin('09ABQFA5416M1ZX')).toBe('ABQFA5416M')
    expect(verifyGstin('09ABQFA5416M1ZY').ok).toBe(false)
    expect(verifyPanForEntity('ABQFA5416M', 3)).toBeNull()
    expect(verifyPanForEntity('ABQFA5416M', 2)).toBeTruthy()
    const active = interpretGstRegistry({
      data: {
        gstin: '09ABQFA5416M1ZX',
        lgnm: 'GAURI GUPTA',
        tradeNam: 'GAURI STORE',
        sts: 'Active',
        ctb: 'Partnership',
      },
    })
    expect(active.ok && active.result.legalName).toBe('GAURI GUPTA')
    expect(
      interpretGstRegistry({ data: { gstin: '09ABQFA5416M1ZX', lgnm: 'X', sts: 'Cancelled' } }).ok,
    ).toBe(false)
    expect(
      interpretGstRegistry(
        { data: { gstin: '09ABQFA5416M1ZX', lgnm: 'X', sts: 'Active' } },
        'DBZPK4951B',
      ).ok,
    ).toBe(false)
  })
})
