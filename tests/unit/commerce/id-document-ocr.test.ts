import { describe, expect, it } from 'vitest'

import {
  extractDateOfBirthFromText,
  extractIdNumberFromText,
  extractNameFromText,
  parseIdDocumentText,
} from '~/lib/payment/id-document-ocr'

describe('id-document-ocr parsers', () => {
  it('extracts India PAN with high confidence', () => {
    const text = `
      INCOME TAX DEPARTMENT
      GOVT OF INDIA
      Permanent Account Number Card
      ABQFA5416M
      Name
      GAURI GUPTA
    `
    expect(extractIdNumberFromText(text)).toEqual({
      number: 'ABQFA5416M',
      confidence: 'high',
    })
  })

  it('extracts DOB in DD/MM/YYYY', () => {
    expect(extractDateOfBirthFromText('Date of Birth 15/08/1990')).toBe('1990-08-15')
    expect(extractDateOfBirthFromText('DOB: 1990-08-15')).toBe('1990-08-15')
  })

  it('extracts name after Name label', () => {
    const name = extractNameFromText('Name\nGauri Gupta\nFather Name\nRamesh')
    expect(name.firstName).toBe('Gauri')
    expect(name.lastName).toBe('Gupta')
  })

  it('ignores father name lines', () => {
    const name = extractNameFromText('Father Name\nRamesh Kumar')
    expect(name.firstName).toBeNull()
  })

  it('parses a full PAN card fixture', () => {
    const parsed = parseIdDocumentText(`
      PERMANENT ACCOUNT NUMBER
      ABQFA5416M
      NAME
      SANJEEV SHUKLA
      DATE OF BIRTH
      12/03/1985
    `)
    expect(parsed.number).toBe('ABQFA5416M')
    expect(parsed.numberConfidence).toBe('high')
    expect(parsed.dateOfBirth).toBe('1985-03-12')
    expect(parsed.firstName).toBe('Sanjeev')
    expect(parsed.lastName).toBe('Shukla')
  })
})
