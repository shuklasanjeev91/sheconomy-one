/**
 * Browser OCR helpers for KYC ID scans (PAN / national ID).
 * Parsers are pure and unit-tested; Tesseract runs only in extractIdFromImage.
 */

export type IdOcrConfidence = 'high' | 'low'

export type IdOcrParseResult = {
  number: string | null
  dateOfBirth: string | null
  firstName: string | null
  lastName: string | null
  numberConfidence: IdOcrConfidence
}

export type IdOcrExtractResult = IdOcrParseResult & {
  rawText: string
  source: 'tesseract'
  extractedAt: string
}

const PAN_RE = /\b([A-Z]{5}[0-9]{4}[A-Z])\b/g
const DOB_DMY_RE = /\b(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})\b/g
const DOB_YMD_RE = /\b(\d{4})[\/\-.](\d{2})[\/\-.](\d{2})\b/g
const GENERIC_ID_RE = /\b([A-Z0-9]{6,18})\b/g

function normalizeOcrText(text: string): string {
  return text
    .replace(/\u2013|\u2014/g, '-')
    .replace(/[^\S\n]+/g, ' ')
    .toUpperCase()
}

/** Prefer India PAN when present; otherwise longest alphanumeric token that looks like an ID. */
export function extractIdNumberFromText(text: string): {
  number: string | null
  confidence: IdOcrConfidence
} {
  const normalized = normalizeOcrText(text)
  const pans = [...normalized.matchAll(PAN_RE)].map((m) => m[1]).filter(Boolean)
  if (pans.length) {
    return { number: pans[0]!, confidence: 'high' }
  }

  const skip = new Set([
    'GOVERNMENT',
    'INDIA',
    'INCOME',
    'TAX',
    'DEPARTMENT',
    'PERMANENT',
    'ACCOUNT',
    'NUMBER',
    'CARD',
    'SIGNATURE',
    'FATHER',
    'NAME',
    'DATE',
    'BIRTH',
  ])
  const candidates = [...normalized.matchAll(GENERIC_ID_RE)]
    .map((m) => m[1]!)
    .filter((token) => {
      if (skip.has(token)) return false
      if (/^\d{8,}$/.test(token)) return false // bare dates
      return /[A-Z]/.test(token) && /\d/.test(token)
    })
    .sort((a, b) => b.length - a.length)

  if (candidates[0]) {
    return { number: candidates[0], confidence: 'low' }
  }
  return { number: null, confidence: 'low' }
}

export function extractDateOfBirthFromText(text: string): string | null {
  const normalized = normalizeOcrText(text)
  const dmy = [...normalized.matchAll(DOB_DMY_RE)]
  for (const match of dmy) {
    const dd = Number(match[1])
    const mm = Number(match[2])
    const yyyy = Number(match[3])
    if (yyyy < 1920 || yyyy > new Date().getFullYear()) continue
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }
  const ymd = [...normalized.matchAll(DOB_YMD_RE)]
  for (const match of ymd) {
    const yyyy = Number(match[1])
    const mm = Number(match[2])
    const dd = Number(match[3])
    if (yyyy < 1920 || yyyy > new Date().getFullYear()) continue
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }
  return null
}

/** Best-effort name near a "Name" label; never invents when unsure. */
export function extractNameFromText(text: string): {
  firstName: string | null
  lastName: string | null
} {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const upper = line.toUpperCase()
    if (/\bFATHER\b|\bMOTHER\b|\bSPOUSE\b/.test(upper)) continue

    let rawName = ''
    const inline = upper.match(/^(?:NAME|NAM)\s*[:\-]\s*(.+)$/)
    if (inline?.[1]) {
      rawName = inline[1].trim()
    } else if (/^(?:NAME|NAM)$/.test(upper)) {
      rawName = lines[i + 1]?.trim() || ''
    }
    if (!rawName) continue
    if (
      /\bFATHER\b|\bMOTHER\b|\bDATE\b|\bBIRTH\b|\bGOVERNMENT\b|\bINCOME\b|\bTAX\b|\bDEPARTMENT\b/.test(
        rawName.toUpperCase(),
      )
    ) {
      continue
    }
    const cleaned = rawName
      .replace(/[^A-Za-z\s.'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned.length < 3) continue
    const parts = cleaned.split(/\s+/).filter((p) => p.length > 1)
    if (parts.length < 1) continue
    if (parts.length === 1) return { firstName: titleCaseWord(parts[0]!), lastName: null }
    return {
      firstName: titleCaseWord(parts[0]!),
      lastName: parts.slice(1).map(titleCaseWord).join(' '),
    }
  }
  return { firstName: null, lastName: null }
}

function titleCaseWord(word: string): string {
  if (!word) return word
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

export function parseIdDocumentText(text: string): IdOcrParseResult {
  const { number, confidence } = extractIdNumberFromText(text)
  const dateOfBirth = extractDateOfBirthFromText(text)
  const { firstName, lastName } = extractNameFromText(text)
  return {
    number,
    dateOfBirth,
    firstName,
    lastName,
    numberConfidence: number ? confidence : 'low',
  }
}

/**
 * Run Tesseract OCR on an ID image/PDF-rendered blob, then parse fields.
 * Call from the browser after the user picks a file.
 */
export async function extractIdFromImage(blob: Blob): Promise<IdOcrExtractResult> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng')
  try {
    const result = await worker.recognize(blob)
    const rawText = result.data.text || ''
    const parsed = parseIdDocumentText(rawText)
    return {
      ...parsed,
      rawText,
      source: 'tesseract',
      extractedAt: new Date().toISOString(),
    }
  } finally {
    await worker.terminate()
  }
}
