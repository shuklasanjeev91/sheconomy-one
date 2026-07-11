import { Image } from '~/components/ui'
import { getSheconomyLogoUrl } from '~/lib/supabase/brand'

import { BRAND_NAME } from '~/config/brand'

/** Brand logo — same assets as NavLogo (icon compact, wordmark full). */
export function AuthBrandLogo({ compact = false }: { compact?: boolean }) {
  const logoUrl = getSheconomyLogoUrl(compact ? 'icon' : 'primary')

  return (
    <Image
      src={logoUrl}
      width={compact ? 40 : 160}
      height={compact ? 40 : 44}
      objectFit="contain"
      alt={`${BRAND_NAME} logo`}
      color="$pink10"
    />
  )
}
