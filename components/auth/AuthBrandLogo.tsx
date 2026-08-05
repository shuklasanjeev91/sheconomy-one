import { BrandLogo } from '~/components/brand/BrandLogo'

/** Brand logo — same bundled assets as NavLogo (icon compact, wordmark full). */
export function AuthBrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <BrandLogo
      compact={compact}
      width={compact ? 48 : 180}
      height={compact ? 48 : 52}
    />
  )
}
