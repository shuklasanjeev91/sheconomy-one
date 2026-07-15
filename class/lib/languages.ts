/** Display labels for program `language` codes stored in the DB. */
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  ar: 'Arabic',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  ur: 'Urdu',
}

export function formatProgramLanguage(code: string | null | undefined): string {
  const normalized = (code ?? 'en').trim().toLowerCase() || 'en'
  return LANGUAGE_LABELS[normalized] ?? normalized.toUpperCase()
}

/** Unique language codes from a program list, sorted by label. */
export function collectProgramLanguages(
  programs: Array<{ language?: string | null }>,
): string[] {
  const codes = new Set<string>()
  for (const program of programs) {
    const code = (program.language ?? 'en').trim().toLowerCase() || 'en'
    codes.add(code)
  }
  return Array.from(codes).sort((a, b) =>
    formatProgramLanguage(a).localeCompare(formatProgramLanguage(b)),
  )
}
